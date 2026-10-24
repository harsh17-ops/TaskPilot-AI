/**
 * Async Handler Wrapper
 * Wraps asynchronous Express route handlers to catch uncaught rejections
 * and automatically forward them to Express error-handling middleware.
 * 
 * @param {Function} fn - Async Express route handler (req, res, next)
 * @returns {Function} Express route handler with automatic error forwarding
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Backwards-compatible alias
export const asyncRoute = asyncHandler;
export default asyncHandler;
