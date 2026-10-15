// Small in-memory rate limiter (per IP + route). Enough for one server instance.
const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 20, key = 'default' } = {}) {
  return (req, res, next) => {
    const id = `${key}|${req.baseUrl}${req.route ? req.route.path : req.path}|${req.ip}`;
    const now = Date.now();
    const b = buckets.get(id);
    if (!b || now > b.reset) {
      buckets.set(id, { count: 1, reset: now + windowMs });
      return next();
    }
    b.count++;
    if (b.count > max) {
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Espere um pouco e tente de novo.' });
    }
    next();
  };
}

// Clean old buckets every 10 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 600_000).unref();

module.exports = { rateLimit };
