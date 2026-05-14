/**
 * Rate limiting middleware using in-memory store.
 * 20 AI calls per hour per authenticated user.
 */

const store = new Map();

function createLimiter({ windowMs, max, keyFn, message }) {
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        retryAfterSeconds: retryAfter,
      });
    }

    entry.count += 1;
    return next();
  };
}

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > oneHour) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * aiLimiter: 20 AI calls per hour per authenticated user.
 */
const aiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyFn: (req) => req.user?.id ? `ai:user:${req.user.id}` : null,
  message: 'AI rate limit exceeded: 20 calls per hour per user.',
});

module.exports = { aiLimiter };
