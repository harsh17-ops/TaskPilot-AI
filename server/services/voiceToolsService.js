import { User, Task, RoutineDay } from '../models/index.js';
import { getLocalDate, ensureRoutineDay } from './routineService.js';
import { calculateStreaks } from './streaks.js';
import { cancelPendingRemindersForTask } from './reminderService.js';
import { invalidateTaskDeadlines } from './deadlineService.js';

/**
 * Voice Tools Service
 * 
 * Provides secure, user-scoped implementations of productivity tools for TaskPilot voice assistant.
 * All functions accept userId as the first argument, ensuring operations can never escape tenant boundaries.
 */

/**
 * Retrieves tasks due today in the user's local timezone.
 */
export async function getTodayTasks(userId) {
  const user = await User.findById(userId);
  const timezone = user?.timezone || 'UTC';
  const todayStr = getLocalDate(timezone);

  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const tasks = await Task.find({
    userId,
    dueDate: { $gte: start, $lt: end },
  }).sort({ priority: 1, status: 1 });

  return {
    date: todayStr,
    count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t._id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
    })),
  };
}

/**
 * Retrieves upcoming tasks due within the next 7 days.
 */
export async function getUpcomingTasks(userId) {
  const user = await User.findById(userId);
  const timezone = user?.timezone || 'UTC';
  const todayStr = getLocalDate(timezone);

  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 8); // next 7 days

  const tasks = await Task.find({
    userId,
    status: { $ne: 'completed' },
    dueDate: { $gte: start, $lt: end },
  }).sort({ dueDate: 1, priority: 1 });

  return {
    window: 'next_7_days',
    count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t._id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
  };
}

/**
 * Retrieves incomplete tasks with due dates in the past.
 */
export async function getOverdueTasks(userId) {
  const now = new Date();
  const tasks = await Task.find({
    userId,
    status: { $ne: 'completed' },
    dueDate: { $lt: now, $ne: null },
  }).sort({ dueDate: 1 });

  return {
    count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t._id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
  };
}

async function resolveVoiceDueDate(userId, dueDate) {
  if (!dueDate) return null;
  const raw = String(dueDate).trim().toLowerCase();

  try {
    const user = await User.findById(userId);
    const timezone = user?.timezone || 'UTC';
    const todayStr = getLocalDate(timezone);

    if (raw === 'today') {
      return new Date(`${todayStr}T12:00:00.000Z`);
    }
    if (raw === 'tomorrow') {
      const tomorrow = new Date(`${todayStr}T12:00:00.000Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return tomorrow;
    }

    const d = new Date(dueDate);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    const d = new Date(dueDate);
    return isNaN(d.getTime()) ? null : d;
  }
}

/**
 * Creates a new task for the authenticated user via voice.
 */
export async function createTask(userId, { title, description = '', priority = 'medium', dueDate = null, estimatedMinutes = null }) {
  if (!title || !String(title).trim()) {
    throw new Error('Task title is required.');
  }

  const validPriorities = ['urgent', 'high', 'medium', 'low'];
  const sanitizedPriority = validPriorities.includes(priority) ? priority : 'medium';

  const parsedDueDate = await resolveVoiceDueDate(userId, dueDate);

  const task = await Task.create({
    userId,
    title: String(title).trim(),
    description: String(description || ''),
    priority: sanitizedPriority,
    dueDate: parsedDueDate,
    estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
    source: 'voice',
  });

  return {
    success: true,
    message: `Created task: "${task.title}" with priority ${task.priority}.`,
    task: {
      id: task._id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    },
  };
}

/**
 * Updates an existing task (reschedule, change priority, etc.).
 */
export async function updateTask(userId, { taskId, titleQuery, title, priority, dueDate, status }) {
  let query = { userId };
  if (taskId) {
    query._id = taskId;
  } else if (titleQuery) {
    const escaped = String(titleQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.title = new RegExp(escaped, 'i');
  } else {
    throw new Error('Specify taskId or titleQuery to identify the task to update.');
  }

  const task = await Task.findOne(query);
  if (!task) {
    return { success: false, message: 'Could not find matching task to update.' };
  }

  if (title && String(title).trim()) task.title = String(title).trim();
  if (priority && ['urgent', 'high', 'medium', 'low'].includes(priority)) task.priority = priority;
  if (status && ['todo', 'in_progress', 'completed'].includes(status)) {
    task.status = status;
    task.completedAt = status === 'completed' ? new Date() : null;
  }
  if (dueDate !== undefined) {
    task.dueDate = await resolveVoiceDueDate(userId, dueDate);
  }

  await task.save();

  if (status === 'completed') {
    await cancelPendingRemindersForTask(task._id);
  }
  if (dueDate !== undefined) {
    await invalidateTaskDeadlines(task._id);
  }

  return {
    success: true,
    message: `Updated task "${task.title}".`,
    task: {
      id: task._id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    },
  };
}

/**
 * Marks a task as completed.
 */
export async function completeTask(userId, { taskId, titleQuery }) {
  let query = { userId };
  if (taskId) {
    query._id = taskId;
  } else if (titleQuery) {
    const escaped = String(titleQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.title = new RegExp(escaped, 'i');
    query.status = { $ne: 'completed' }; // pick active first
  } else {
    throw new Error('Specify taskId or titleQuery to complete.');
  }

  const task = await Task.findOne(query);
  if (!task) {
    return { success: false, message: 'Could not find matching task to complete.' };
  }

  task.status = 'completed';
  task.completedAt = new Date();
  await task.save();

  // Invalidate any pending reminders for this completed task
  await cancelPendingRemindersForTask(task._id);

  return {
    success: true,
    message: `Marked "${task.title}" as completed. Great job!`,
    task: {
      id: task._id,
      title: task.title,
      status: 'completed',
    },
  };
}

/**
 * Returns today's daily routine checklist status and routine streak.
 */
export async function getRoutineStatus(userId) {
  const user = await User.findById(userId);
  const timezone = user?.timezone || 'UTC';
  const todayStr = getLocalDate(timezone);

  const day = await ensureRoutineDay(userId, todayStr, timezone);
  const allDays = await RoutineDay.find({ userId }).sort({ localDate: 1 });
  const streaks = calculateStreaks(allDays, todayStr);

  const required = day.items.filter((i) => i.isRequired);
  const completedRequired = required.filter((i) => i.completed);
  const percent = required.length ? Math.round((completedRequired.length / required.length) * 100) : 0;

  return {
    date: todayStr,
    routinePercent: percent,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    todayComplete: streaks.todayComplete,
    habits: day.items.map((i) => ({
      title: i.title,
      isRequired: i.isRequired,
      completed: i.completed,
    })),
  };
}

/**
 * Returns an aggregated productivity summary (tasks + routines).
 */
export async function getProductivitySummary(userId) {
  const user = await User.findById(userId);
  const timezone = user?.timezone || 'UTC';
  const todayStr = getLocalDate(timezone);

  await ensureRoutineDay(userId, todayStr, timezone);
  const [tasks, days] = await Promise.all([
    Task.find({ userId }),
    RoutineDay.find({ userId }),
  ]);

  const dueToday = tasks.filter((t) => t.dueDate && t.dueDate.toISOString().slice(0, 10) === todayStr);
  const completedToday = tasks.filter(
    (t) => t.status === 'completed' && t.completedAt && t.completedAt.toISOString().slice(0, 10) === todayStr
  );
  const overdue = tasks.filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < new Date());
  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  const todaySnapshot = days.find((d) => d.localDate === todayStr);
  const required = todaySnapshot?.items?.filter((i) => i.isRequired) || [];
  const percent = required.length ? Math.round((required.filter((i) => i.completed).length / required.length) * 100) : 0;

  const streaks = calculateStreaks(days, todayStr);

  return {
    activeTasksCount: activeTasks.length,
    dueTodayCount: dueToday.length,
    completedTodayCount: completedToday.length,
    overdueCount: overdue.length,
    routinePercent: percent,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };
}

/**
 * Master dispatcher for executing a named tool with arguments.
 */
export async function executeVoiceTool(userId, toolName, args = {}) {
  switch (toolName) {
    case 'get_today_tasks':
      return await getTodayTasks(userId);
    case 'get_upcoming_tasks':
      return await getUpcomingTasks(userId);
    case 'get_overdue_tasks':
      return await getOverdueTasks(userId);
    case 'create_task':
      return await createTask(userId, args);
    case 'update_task':
      return await updateTask(userId, args);
    case 'complete_task':
      return await completeTask(userId, args);
    case 'get_routine_status':
      return await getRoutineStatus(userId);
    case 'get_productivity_summary':
      return await getProductivitySummary(userId);
    default:
      throw new Error(`Tool "${toolName}" is not supported.`);
  }
}
