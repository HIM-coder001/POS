const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for authentication endpoints.
 * 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  skipSuccessfulRequests: true, // only count failed attempts
});

/**
 * M-Pesa STK Push limiter.
 * 20 pushes per hour per IP — prevents spam abuse at Safaricom billing cost.
 */
const mpesaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many M-Pesa requests. Please wait an hour before trying again.',
  },
});

/**
 * General API limiter — broad protection for all other routes.
 * 200 requests per minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

module.exports = { authLimiter, mpesaLimiter, generalLimiter };
