/**
 * Wraps an async route handler so any rejected promise or thrown error
 * is forwarded to Express's next(err) instead of causing an unhandled rejection.
 *
 * Express 5 does this automatically, but wrapping explicitly makes the intent
 * clear and keeps the pattern compatible with Express 4 as well.
 *
 * @param {(req, res, next) => Promise<any>} fn
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
