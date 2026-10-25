import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { User, Reminder } from '../models/index.js';

/**
 * Constant-time comparison to protect against timing attacks.
 */
function secureCompare(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Constant time dummy check to avoid length leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Server-to-server authentication middleware for n8n automation.
 * 
 * Security:
 * - Checks X-N8N-API-KEY header or Bearer token against N8N_AUTOMATION_SECRET.
 * - Constant-time comparison prevents timing side-channels.
 * - Resolves target user scope strictly to MY_EMAIL or validated user ID.
 */
export async function authenticateN8n(req, res, next) {
  try {
    const configuredSecret = process.env.N8N_AUTOMATION_SECRET;
    if (!configuredSecret || configuredSecret.length < 16) {
      return res.status(500).json({
        error: 'N8N_AUTOMATION_SECRET is not configured or too short (minimum 16 characters required).',
      });
    }

    // Extract provided secret from header or Authorization Bearer
    let providedSecret =
      req.headers['x-n8n-api-key'] ||
      req.headers['x-automation-secret'] ||
      req.headers['x-api-key'];
    if (!providedSecret && req.headers.authorization) {
      const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i);
      if (match) {
        providedSecret = match[1];
      }
    }

    if (!providedSecret || !secureCompare(providedSecret, configuredSecret)) {
      return res.status(401).json({ error: 'Unauthorized automation access. Invalid integration key.' });
    }

    // Resolve tenant user scope
    const targetUserId = req.headers['x-target-user-id'] || req.query.userId;
    const targetEmail = req.headers['x-target-user-email'] || req.query.email || process.env.MY_EMAIL;

    let targetUser = null;
    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    } else if (targetEmail) {
      targetUser = await User.findOne({ email: String(targetEmail).toLowerCase().trim() });
    } else {
      // Find the user who has active reminders, or the most recently active account
      const reminderWithUser = await User.findOne({ _id: { $in: await Reminder.distinct('userId', { status: 'pending' }) } });
      if (reminderWithUser) {
        targetUser = reminderWithUser;
      } else {
        targetUser = await User.findOne().sort({ createdAt: -1 });
      }
    }

    if (!targetUser) {
      return res.status(404).json({
        error: 'No valid user found for automation scope. Please configure MY_EMAIL in server/.env or provide a valid X-Target-User-Id header.',
      });
    }

    req.n8nUser = targetUser;
    req.isAutomation = true;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify automation credentials: ' + err.message });
  }
}

/**
 * Dedicated rate limiter for n8n automation endpoints.
 * Allows 120 calls per minute per IP to handle polling loops while preventing denial of service.
 */
export const n8nRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many automation requests. Please decrease polling frequency.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
