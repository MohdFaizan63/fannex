/**
 * Redis response-cache middleware.
 *
 * Caches JSON responses in Redis with a configurable TTL.
 * If Redis is unavailable the middleware is a no-op (pass-through).
 *
 * Usage:
 *   router.get('/list', redisCache(60), listCreators);
 */
const { getRedis } = require('../config/redis');

/**
 * @param {number} ttlSeconds  cache time-to-live (default 60)
 */
const redisCache = (ttlSeconds = 60) => async (req, res, next) => {
    const client = getRedis();
    if (!client) return next(); // Redis not available — skip

    const key = `cache:${req.originalUrl}`;

    try {
        const cached = await client.get(key);
        if (cached) {
            const parsed = JSON.parse(cached);
            return res.status(200).json(parsed);
        }
    } catch (_) {
        // Redis read failed — just continue to handler
        return next();
    }

    // Monkey-patch res.json to intercept the response and cache it
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
                client.setex(key, ttlSeconds, JSON.stringify(body)).catch(() => { });
            } catch (_) { /* ignore cache write errors */ }
        }
        return originalJson(body);
    };

    next();
};

module.exports = redisCache;
