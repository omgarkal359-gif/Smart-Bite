import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/**
 * Custom distributed rate-limiting store wrapper.
 * Checks for Upstash REST endpoint environment variables (UPSTASH_REDIS_REST_URL).
 * If available, evaluates rate limits via Redis REST API.
 * Otherwise, falls back to memory rate limiting.
 */
export function createDistributedRateLimiter({ windowMs, max, message }) {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    return async (req, res, next) => {
      try {
        const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const key = `rate_limit:${req.baseUrl || req.path}:${ip}`;
        const windowSec = Math.ceil(windowMs / 1000);

        // Execute atomic INCR + EXPIRE via Upstash REST API
        const response = await fetch(`${upstashUrl}/pipeline`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${upstashToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([
            ['INCR', key],
            ['EXPIRE', key, windowSec]
          ])
        });

        if (response.ok) {
          const data = await response.json();
          const currentCount = data[0]?.result || 1;

          res.setHeader('X-RateLimit-Limit', max);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, max - currentCount));

          if (currentCount > max) {
            return res.status(429).json(message || { success: false, message: 'Too many requests. Please try again later.' });
          }
          return next();
        }
      } catch (err) {
        console.warn('[REDIS RATE LIMIT WARNING] Upstash Redis request failed, falling back to memory rate limiter:', err.message);
      }
      return fallbackLimiter(req, res, next);
    };
  }

  const fallbackLimiter = rateLimit({
    windowMs,
    max,
    message: message || { success: false, message: 'Rate limit exceeded.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  return fallbackLimiter;
}
