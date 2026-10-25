import express from 'express';
import { Task } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { cancelPendingRemindersForTask } from '../services/reminderService.js';
import { invalidateTaskDeadlines } from '../services/deadlineService.js';

const router = express.Router();

// All task routes require authentication
router.use(authenticateToken);

/**
 * GET /api/tasks
 * Fetches user's tasks with optional filtering:
 * - status: 'todo' | 'in_progress' | 'completed'
 * - priority: 'urgent' | 'high' | 'medium' | 'low'
 * - date: 'YYYY-MM-DD' (matches due dates occurring within that calendar day)
 * - search: keyword search against task title or description
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = { userId: req.user.id };

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    if (req.query.date) {
      // Support matching dates stored in UTC or local server time for YYYY-MM-DD
      const utcStart = new Date(`${req.query.date}T00:00:00.000Z`);
      const utcEnd = new Date(`${req.query.date}T23:59:59.999Z`);

      const localStart = new Date(`${req.query.date}T00:00:00`);
      const localEnd = new Date(localStart);
      localEnd.setDate(localEnd.getDate() + 1);

      const minStart = new Date(Math.min(utcStart.getTime(), localStart.getTime()));
      const maxEnd = new Date(Math.max(utcEnd.getTime(), localEnd.getTime()));

      query.dueDate = { $gte: minStart, $lte: maxEnd };
    }

    if (req.query.search) {
      // Escape special characters to prevent regex injection
      const escapedSearch = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: new RegExp(escapedSearch, 'i') },
        { description: new RegExp(escapedSearch, 'i') },
      ];
    }

    const tasks = await Task.find(query)
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(500);

    return res.json({ tasks });
  })
);

/**
 * POST /api/tasks
 * Creates a new task for the authenticated user.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, description, priority, dueDate, estimatedMinutes, source } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority.' });
    }

    const task = await Task.create({
      userId: req.user.id,
      title: title.trim(),
      description,
      priority,
      dueDate: dueDate || null,
      estimatedMinutes: estimatedMinutes || null,
      source: source || 'manual',
    });

    return res.status(201).json({ task });
  })
);

/**
 * PATCH /api/tasks/:id
 * Updates an existing task.
 * Automatically tracks or clears completedAt timestamp when status changes.
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const allowedFields = ['title', 'description', 'priority', 'status', 'dueDate', 'estimatedMinutes'];
    const changes = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );

    // Maintain accurate completion timestamp
    if (changes.status === 'completed') {
      changes.completedAt = new Date();
    } else if (changes.status && changes.status !== 'completed') {
      changes.completedAt = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: changes },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Invalidate pending reminders if marked completed
    if (changes.status === 'completed') {
      await cancelPendingRemindersForTask(task._id);
    }

    // Invalidate obsolete automated deadline notifications if dueDate was updated
    if (changes.dueDate !== undefined) {
      await invalidateTaskDeadlines(task._id);
    }

    return res.json({ task });
  })
);

/**
 * DELETE /api/tasks/:id
 * Removes a task owned by the authenticated user.
 * Automatically cancels any pending reminders and clears deadline ledger entries to prevent orphans.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Cancel pending reminders and clean up deadline alert ledger
    await cancelPendingRemindersForTask(task._id);
    await invalidateTaskDeadlines(task._id);

    return res.json({ ok: true });
  })
);

export default router;
