import { Task, User, RoutineDay, Routine } from '../models/index.js';
import { calculateStreaks } from './streaks.js';
import { getLocalDate, ensureRoutineDay } from './routineService.js';

/**
 * Productivity Report Service
 * 
 * Aggregates verified task and routine statistics for morning briefings,
 * evening reviews, and weekly productivity reports.
 * 
 * Strict Data Integrity Rules:
 * - Uses actual task.completedAt timestamps; does not infer completion time from current status.
 * - Slices calendar date boundaries cleanly according to the user's timezone (defaults to Asia/Kolkata).
 * - Distinguishes ordinary tasks from routine checklists. Ordinary tasks NEVER increase routine streaks.
 * - Sourced directly from MongoDB using existing streak calculation logic.
 */

/**
 * Computes start and end UTC timestamps for a given YYYY-MM-DD date in the given timezone.
 * 
 * @param {string} localDateStr - 'YYYY-MM-DD'
 * @param {string} [timeZone='Asia/Kolkata']
 * @returns {{ startUtc: Date, endUtc: Date }}
 */
export function getLocalDayUtcBounds(localDateStr, timeZone = 'Asia/Kolkata') {
  // Approximate with midday offset, then calculate exact boundary
  const [year, month, day] = localDateStr.split('-').map(Number);
  
  // Format with Intl to find exact UTC offset for this day
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(testDate);
  
  const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value || '+05:30';
  // Parse offset like "+05:30" or "GMT+5:30"
  const match = offsetPart.match(/([+-])(\d{1,2}):?(\d{2})?/);
  let offsetMinutes = 330; // default to Asia/Kolkata (+5:30)
  if (match) {
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    offsetMinutes = sign * (hours * 60 + mins);
  }

  // Local 00:00:00 in UTC = Date.UTC(year, month - 1, day) - offsetMinutes
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000);
  const endUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMinutes * 60 * 1000);

  return { startUtc, endUtc };
}

/**
 * Helper to check whether a Date falls on localDateStr in the given timezone.
 */
export function isSameLocalDate(date, localDateStr, timeZone = 'Asia/Kolkata') {
  if (!date) return false;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
  return formatted === localDateStr;
}

/**
 * Retrieves morning briefing dataset.
 */
export async function getMorningBriefingData(userId, timeZone = 'Asia/Kolkata') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const todayStr = getLocalDate(timeZone);
  const { startUtc, endUtc } = getLocalDayUtcBounds(todayStr, timeZone);
  const now = new Date();

  // Ensure routine snapshot exists for today
  const todayRoutineDay = await ensureRoutineDay(user._id, todayStr, timeZone);
  const allRoutineDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
  const streakStats = calculateStreaks(allRoutineDays, todayStr);

  const allUserTasks = await Task.find({ userId: user._id }).lean();

  const tasksDueToday = allUserTasks.filter((t) => {
    return t.dueDate && isSameLocalDate(t.dueDate, todayStr, timeZone);
  });

  const overdueTasks = allUserTasks.filter((t) => {
    return t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now && !isSameLocalDate(t.dueDate, todayStr, timeZone);
  });

  const highPriorityIncomplete = allUserTasks.filter((t) => {
    return (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed';
  });

  // Upcoming deadlines in the next 48 hours beyond today
  const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const upcomingDeadlines = allUserTasks.filter((t) => {
    return t.status !== 'completed' && t.dueDate && new Date(t.dueDate) > endUtc && new Date(t.dueDate) <= next48Hours;
  });

  const totalEstimatedMinutesToday = tasksDueToday.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);

  // Routine Checklist summary
  const requiredItems = todayRoutineDay.items.filter((item) => item.isRequired);
  const completedRequiredCount = requiredItems.filter((item) => item.completed).length;

  return {
    date: todayStr,
    timeZone,
    user: { id: user._id, name: user.name, email: user.email },
    summary: {
      dueTodayCount: tasksDueToday.length,
      overdueCount: overdueTasks.length,
      highPriorityIncompleteCount: highPriorityIncomplete.length,
      upcomingDeadlinesCount: upcomingDeadlines.length,
      totalEstimatedMinutesToday,
    },
    tasksDueToday: tasksDueToday.map(formatMinimalTask),
    overdueTasks: overdueTasks.map(formatMinimalTask),
    highPriorityIncomplete: highPriorityIncomplete.map(formatMinimalTask),
    upcomingDeadlines: upcomingDeadlines.map(formatMinimalTask),
    routineSummary: {
      eligible: todayRoutineDay.eligible,
      totalRequired: requiredItems.length,
      completedRequired: completedRequiredCount,
      percent: requiredItems.length ? Math.round((completedRequiredCount / requiredItems.length) * 100) : 0,
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      todayComplete: streakStats.todayComplete,
    },
  };
}

/**
 * Retrieves evening review dataset.
 */
export async function getEveningReviewData(userId, timeZone = 'Asia/Kolkata') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const todayStr = getLocalDate(timeZone);
  const now = new Date();

  // Routine status
  const todayRoutineDay = await ensureRoutineDay(user._id, todayStr, timeZone);
  const allRoutineDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
  const streakStats = calculateStreaks(allRoutineDays, todayStr);

  const allUserTasks = await Task.find({ userId: user._id }).lean();

  // Strict: only tasks with actual completedAt occurring within today's local date
  const completedToday = allUserTasks.filter((t) => {
    return t.status === 'completed' && t.completedAt && isSameLocalDate(t.completedAt, todayStr, timeZone);
  });

  const pendingTasks = allUserTasks.filter((t) => t.status !== 'completed');

  const overdue = pendingTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);

  const importantIncomplete = pendingTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');

  const requiredItems = todayRoutineDay.items.filter((item) => item.isRequired);
  const completedRequiredCount = requiredItems.filter((item) => item.completed).length;

  return {
    date: todayStr,
    timeZone,
    user: { id: user._id, name: user.name, email: user.email },
    completedToday: completedToday.map(formatMinimalTask),
    pendingTasks: pendingTasks.map(formatMinimalTask),
    overdueTasks: overdue.map(formatMinimalTask),
    importantIncomplete: importantIncomplete.map(formatMinimalTask),
    routineStatus: {
      eligible: todayRoutineDay.eligible,
      totalRequired: requiredItems.length,
      completedRequired: completedRequiredCount,
      percent: requiredItems.length ? Math.round((completedRequiredCount / requiredItems.length) * 100) : 0,
    },
    streaks: streakStats,
  };
}

/**
 * Computes previous Monday-to-Sunday date range in the given timezone.
 * 
 * @param {string} [timeZone='Asia/Kolkata']
 * @returns {{ mondayStr: string, sundayStr: string, startUtc: Date, endUtc: Date }}
 */
export function getPreviousMondayToSundayRange(timeZone = 'Asia/Kolkata') {
  const todayStr = getLocalDate(timeZone);
  const todayMidday = new Date(`${todayStr}T12:00:00Z`);
  const dayOfWeek = todayMidday.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Number of days to subtract to get to the most recent previous Sunday
  // If today is Monday (1), previous Sunday was 1 day ago.
  // If today is Sunday (0), previous Sunday was 7 days ago.
  const daysToPrevSunday = dayOfWeek === 0 ? 7 : dayOfWeek;

  const prevSundayDate = new Date(todayMidday);
  prevSundayDate.setUTCDate(todayMidday.getUTCDate() - daysToPrevSunday);

  const prevMondayDate = new Date(prevSundayDate);
  prevMondayDate.setUTCDate(prevSundayDate.getUTCDate() - 6);

  const mondayStr = prevMondayDate.toISOString().slice(0, 10);
  const sundayStr = prevSundayDate.toISOString().slice(0, 10);

  const { startUtc } = getLocalDayUtcBounds(mondayStr, timeZone);
  const { endUtc } = getLocalDayUtcBounds(sundayStr, timeZone);

  return { mondayStr, sundayStr, startUtc, endUtc };
}

/**
 * Retrieves weekly productivity report dataset.
 */
export async function getWeeklyReportData(userId, timeZone = 'Asia/Kolkata') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const { mondayStr, sundayStr, startUtc, endUtc } = getPreviousMondayToSundayRange(timeZone);
  const todayStr = getLocalDate(timeZone);

  const allTasks = await Task.find({ userId: user._id }).lean();
  const allRoutineDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
  const streakStats = calculateStreaks(allRoutineDays, todayStr);

  // Tasks completed during the Monday-Sunday week
  const completedInWeek = allTasks.filter((t) => {
    return t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= startUtc && new Date(t.completedAt) <= endUtc;
  });

  const openTasks = allTasks.filter((t) => t.status !== 'completed');
  const now = new Date();
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);

  // Routine days falling within this week
  const weekRoutineDays = allRoutineDays.filter((d) => d.localDate >= mondayStr && d.localDate <= sundayStr);
  const eligibleWeekDays = weekRoutineDays.filter((d) => d.eligible);
  const successfulWeekDays = eligibleWeekDays.filter((d) => {
    const required = d.items.filter((i) => i.isRequired);
    return required.length > 0 && required.every((i) => i.completed);
  });

  const routineConsistencyRate = eligibleWeekDays.length
    ? Math.round((successfulWeekDays.length / eligibleWeekDays.length) * 100)
    : 0;

  return {
    period: {
      monday: mondayStr,
      sunday: sundayStr,
      label: `${mondayStr} to ${sundayStr}`,
      startUtc,
      endUtc,
    },
    timeZone,
    user: { id: user._id, name: user.name, email: user.email },
    metrics: {
      completedCount: completedInWeek.length,
      openCount: openTasks.length,
      overdueCount: overdueTasks.length,
      routineConsistencyRate,
      eligibleRoutineDays: eligibleWeekDays.length,
      successfulRoutineDays: successfulWeekDays.length,
    },
    completedTasks: completedInWeek.map(formatMinimalTask),
    openTasks: openTasks.map(formatMinimalTask),
    overdueTasks: overdueTasks.map(formatMinimalTask),
    routineStreaks: {
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
    },
  };
}

/**
 * Returns read-only routine summary and streak statistics.
 */
export async function getRoutineSummary(userId, timeZone = 'Asia/Kolkata') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');

  const todayStr = getLocalDate(timeZone);
  const day = await ensureRoutineDay(user._id, todayStr, timeZone);
  const allDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
  const streaks = calculateStreaks(allDays, todayStr);
  const templates = await Routine.find({ userId: user._id, isActive: true }).sort({ sortOrder: 1 });

  return {
    today: todayStr,
    timeZone,
    day,
    streaks,
    activeTemplatesCount: templates.length,
  };
}

/**
 * Formats a task document into a minimal, safe payload for external automations.
 * Never includes internal hashes or unnecessary metadata.
 */
function formatMinimalTask(task) {
  return {
    id: task._id,
    title: task.title,
    description: task.description || undefined,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate || null,
    estimatedMinutes: task.estimatedMinutes || null,
    completedAt: task.completedAt || null,
  };
}
