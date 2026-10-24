import express from 'express';
import { User, Task, RoutineDay } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { calculateStreaks } from '../services/streaks.js';
import { getLocalDate, ensureRoutineDay } from '../services/routineService.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/analytics/summary
 * Provides a high-level productivity summary:
 * - Total, active, due today, completed today, and overdue task counts
 * - Current and longest routine streak statistics
 * - Today's routine checklist completion percentage
 * - Five most recently updated tasks for the dashboard
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const today = getLocalDate(user.timezone);

    // Make sure today's routine snapshot exists
    await ensureRoutineDay(user._id, today, user.timezone);

    const [tasks, days] = await Promise.all([
      Task.find({ userId: user._id }),
      RoutineDay.find({ userId: user._id }),
    ]);

    const formatInUserTz = (dateObj) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone }).format(dateObj);

    const dueToday = tasks.filter(
      (t) => t.dueDate && today === formatInUserTz(t.dueDate)
    );

    const completedToday = tasks.filter(
      (t) => t.status === 'completed' && t.completedAt && today === formatInUserTz(t.completedAt)
    );

    const overdue = tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && t.dueDate < new Date()
    );

    const todaySnapshot = days.find((d) => d.localDate === today);
    const requiredItems = todaySnapshot?.items.filter((i) => i.isRequired) || [];
    const completedRequiredCount = requiredItems.filter((i) => i.completed).length;

    const routinePercent = requiredItems.length
      ? Math.round((completedRequiredCount / requiredItems.length) * 100)
      : 0;

    const streaks = calculateStreaks(days, today);
    const recentTasks = tasks.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

    return res.json({
      tasksTotal: tasks.length,
      dueToday: dueToday.length,
      completedToday: completedToday.length,
      overdue: overdue.length,
      activeTasks: tasks.filter((t) => t.status !== 'completed').length,
      routinePercent,
      streaks,
      recentTasks,
    });
  })
);

/**
 * GET /api/analytics/tasks
 * Returns 7-day task creation vs. completion activity and priority distribution.
 */
router.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const tasks = await Task.find({ userId: req.user.id });

    const todayStr = getLocalDate(user.timezone);
    const baseDate = new Date(`${todayStr}T12:00:00`);

    const formatInUserTz = (value) =>
      value
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: user.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(value)
        : '';

    // Calculate 7-day activity window (6 days ago through today)
    const daily = [];
    for (let offset = 6; offset >= 0; offset--) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() - offset);
      const label = targetDate.toLocaleDateString('en-CA');

      daily.push({
        date: label,
        created: tasks.filter((task) => formatInUserTz(task.createdAt) === label).length,
        completed: tasks.filter((task) => formatInUserTz(task.completedAt) === label).length,
      });
    }

    const priority = ['urgent', 'high', 'medium', 'low'].map((name) => ({
      name,
      value: tasks.filter((task) => task.priority === name).length,
    }));

    return res.json({ priority, daily });
  })
);

export default router;
