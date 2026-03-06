/**
 * Redis client (optional).
 *
 * If Redis is available it will be used for response caching.
 * If not, the app continues normally — caching middleware will
 * silently skip when `redisClient` is null.
 */
const Redis = require('ioredis');

let redisClient = null;

try {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    redisClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
            if (times > 3) return null; // stop retrying
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    redisClient.connect()
        .then(() => console.log('🟢 Redis connected'))
        .catch(() => {
            console.warn('⚠️  Redis not available — response caching disabled');
            redisClient = null;
        });

    redisClient.on('error', () => {
        // Suppress repeated connection error noise after initial warning
    });
} catch (_) {
    console.warn('⚠️  Redis not available — response caching disabled');
    redisClient = null;
}

/** Safe getter — returns null when Redis is down. */
const getRedis = () => redisClient;

module.exports = { getRedis };
