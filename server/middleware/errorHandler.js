/**
 * Centralized Error Handling Middleware
 * 
 * Intercepts unhandled errors across all routes.
 * Maps Mongoose validation errors to 400 Bad Request with user-friendly messages,
 * and masks internal implementation errors behind a clean 500 error response.
 */
export function errorHandler(err, req, res, next) {
  console.error('[Server Error]:', err.message || err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Please check the submitted values.',
      details: err.errors ? Object.keys(err.errors).map((key) => err.errors[key].message) : undefined,
    });
  }

  return res.status(500).json({
    error: 'Something went wrong. Please try again.',
  });
}

export default errorHandler;
