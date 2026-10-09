const { rateLimit } = require('express-rate-limit');

// Stops people trying to guess passwords by brute force: by default 10 attempts
// every 15 minutes per IP. LOGIN_ATTEMPT_LIMIT changes the number (the tests use a high value).
function loginLimiter(max = Number(process.env.LOGIN_ATTEMPT_LIMIT) || 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Wait a few minutes and try again.' },
  });
}

module.exports = loginLimiter;
