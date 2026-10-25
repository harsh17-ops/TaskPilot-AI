import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * 
 * Verifies the JWT session token sent via the HTTP-only 'taskpilot' cookie.
 * Attaches the decoded payload ({ id: userId }) to `req.user`.
 * 
 * Security rationale:
 * Storing the JWT in an HTTP-only, SameSite=Lax cookie protects against XSS token theft
 * while maintaining seamless user sessions across page reloads.
 */
export function authenticateToken(req, res, next) {
  try {
    let token = req.cookies?.taskpilot;
    if (!token && req.headers.authorization) {
      const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Please sign in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session expired. Please sign in again.' });
  }
}

// Backwards-compatible alias
export const auth = authenticateToken;
export default authenticateToken;
