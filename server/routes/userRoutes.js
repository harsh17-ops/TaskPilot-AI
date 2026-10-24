import express from 'express';
import { User } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { formatPublicUser } from './authRoutes.js';

const router = express.Router();

/**
 * PATCH /api/users/me
 * Updates user profile settings (name and timezone).
 * Validates timezone string using Intl.DateTimeFormat.
 */
router.patch(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const updates = {};

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      updates.name = req.body.name.trim();
    }

    if (typeof req.body.timezone === 'string') {
      try {
        // Validate timezone string against browser/runtime IANA database
        Intl.DateTimeFormat('en-US', { timeZone: req.body.timezone });
        updates.timezone = req.body.timezone;
      } catch {
        return res.status(400).json({ error: 'Use a valid timezone such as Asia/Kolkata.' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );

    return res.json({ user: formatPublicUser(updatedUser) });
  })
);

export default router;
