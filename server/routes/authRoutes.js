import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User, Routine } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Strict rate limiter for authentication endpoints to prevent brute-force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // max 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Cookie settings for secure JWT session management
export const tokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Strips sensitive fields (like passwordHash) before sending user profile data to the client.
 */
export const formatPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  timezone: user.timezone,
  preferences: user.preferences,
});

/**
 * POST /api/auth/signup
 * Registers a new user account, initializes default routine habits,
 * and sets an HTTP-only JWT session cookie.
 */
router.post(
  '/signup',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // Validate request body
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!name?.trim() || !emailRegex.test(email || '') || !password || password.length < 8) {
      return res.status(400).json({
        error: 'Enter a name, valid email, and password with at least 8 characters.',
      });
    }

    // Check for duplicate account
    const existing = await User.exists({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password using bcrypt (work factor 12)
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash,
    });

    // Seed default daily routines so new users have a starting rhythm
    const defaultRoutines = [
      'Review daily goals',
      'Exercise or stretch',
      'Read or learn for 20 minutes',
      'Plan tomorrow',
    ];
    await Routine.insertMany(
      defaultRoutines.map((title, index) => ({
        userId: user._id,
        title,
        sortOrder: index,
      }))
    );

    // Issue JWT in HTTP-only cookie
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('taskpilot', token, tokenCookieOptions);

    return res.status(201).json({ user: formatPublicUser(user) });
  })
);

/**
 * POST /api/auth/login
 * Validates credentials, sets session cookie, and returns user profile.
 */
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() });

    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('taskpilot', token, tokenCookieOptions);

    return res.json({ user: formatPublicUser(user) });
  })
);

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('taskpilot', { ...tokenCookieOptions, maxAge: undefined });
  return res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user's profile details.
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }
    return res.json({ user: formatPublicUser(user) });
  })
);

export default router;
