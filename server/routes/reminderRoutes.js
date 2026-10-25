import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createReminder,
  getRemindersForTask,
  getUserReminders,
  updateReminder,
  cancelReminder,
} from '../services/reminderService.js';
import { Reminder } from '../models/index.js';

const router = express.Router();

// All reminder endpoints require authentication
router.use(authenticateToken);

/**
 * GET /api/reminders
 * Lists all reminders for the authenticated user, optionally filtered by status or taskId.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const reminders = await getUserReminders(req.user.id, {
      status: req.query.status,
      taskId: req.query.taskId,
    });
    return res.json({ reminders });
  })
);

/**
 * GET /api/reminders/task/:taskId
 * Lists all reminders for a specific task owned by the authenticated user.
 */
router.get(
  '/task/:taskId',
  asyncHandler(async (req, res) => {
    const reminders = await getRemindersForTask(req.user.id, req.params.taskId);
    return res.json({ reminders });
  })
);

/**
 * POST /api/reminders
 * Creates a scheduled reminder for an owned task.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { taskId, scheduledAt, timezone, note } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required.' });
    }
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required.' });
    }

    try {
      const reminder = await createReminder({
        userId: req.user.id,
        taskId,
        scheduledAt,
        timezone: timezone || 'Asia/Kolkata',
        note,
      });

      return res.status(201).json({ reminder });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  })
);

/**
 * PATCH /api/reminders/:id
 * Updates or reschedules an existing reminder.
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { scheduledAt, timezone, note, status } = req.body;

    try {
      const reminder = await updateReminder(req.user.id, req.params.id, {
        scheduledAt,
        timezone,
        note,
        status,
      });

      return res.json({ reminder });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  })
);

/**
 * DELETE /api/reminders/:id
 * Cancels a reminder owned by the authenticated user.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      const reminder = await cancelReminder(req.user.id, req.params.id);
      return res.json({ ok: true, reminder });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  })
);

export default router;
