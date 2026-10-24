import express from 'express';
import { User, Routine, RoutineDay } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { calculateStreaks } from '../services/streaks.js';
import { getLocalDate, ensureRoutineDay } from '../services/routineService.js';

const router = express.Router();

// All routine endpoints require authentication
router.use(authenticateToken);

/**
 * GET /api/routines
 * Retrieves all habit templates defined by the user.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const routines = await Routine.find({ userId: req.user.id }).sort({ sortOrder: 1 });
    return res.json({ routines });
  })
);

/**
 * POST /api/routines
 * Creates a new routine habit template.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.body.title?.trim()) {
      return res.status(400).json({ error: 'Routine title is required.' });
    }

    const routine = await Routine.create({
      userId: req.user.id,
      title: req.body.title.trim(),
      isRequired: req.body.isRequired !== false,
      scheduledDays: req.body.scheduledDays || [0, 1, 2, 3, 4, 5, 6],
    });

    return res.status(201).json({ routine });
  })
);

/**
 * GET /api/routines/day
 * Fetches the routine checklist snapshot and streak calculation for a specific date.
 * If no date query parameter is provided, defaults to today in the user's timezone.
 */
router.get(
  '/day',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const today = getLocalDate(user.timezone);
    const date = req.query.date || today;

    // Ensure snapshot exists for the requested date
    const day = await ensureRoutineDay(user._id, date, user.timezone);
    const allDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
    const streaks = calculateStreaks(allDays, date);

    return res.json({
      day,
      streaks,
      today,
    });
  })
);

/**
 * GET /api/routines/history
 * Returns the last 180 daily checklist records for habit analysis and trends.
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const days = await RoutineDay.find({ userId: req.user.id })
      .sort({ localDate: -1 })
      .limit(180);
    return res.json({ days });
  })
);

/**
 * PATCH /api/routines/day/:routineId
 * Toggles completion status of a specific habit item on a specific date checklist.
 * Recalculates user streaks based on the updated snapshot.
 */
router.patch(
  '/day/:routineId',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    const today = getLocalDate(user.timezone);
    const date = req.body.date || today;

    const day = await ensureRoutineDay(user._id, date, user.timezone);
    const item = day.items.find(
      (entry) => String(entry.routineId) === req.params.routineId
    );

    if (!item) {
      return res.status(404).json({ error: 'This routine item is not scheduled for that date.' });
    }

    item.completed = Boolean(req.body.completed);
    item.completedAt = item.completed ? new Date() : null;
    await day.save();

    const allDays = await RoutineDay.find({ userId: user._id }).sort({ localDate: 1 });
    const streaks = calculateStreaks(allDays, today);

    return res.json({ day, streaks });
  })
);

/**
 * PATCH /api/routines/:id
 * Updates a routine habit template (title, isRequired, isActive, sortOrder, etc.).
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const allowedKeys = ['title', 'description', 'isRequired', 'isActive', 'scheduledDays', 'sortOrder'];
    const changes = {};

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        changes[key] = req.body[key];
      }
    }

    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: changes },
      { new: true, runValidators: true }
    );

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found.' });
    }

    return res.json({ routine });
  })
);

/**
 * DELETE /api/routines/:id
 * Removes a routine habit template owned by the authenticated user.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Routine.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Routine not found.' });
    }

    return res.json({ ok: true });
  })
);

export default router;
