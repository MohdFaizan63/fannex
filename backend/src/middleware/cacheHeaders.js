/**
 * Cache-Control header middleware.
 *
 * Attach to routes that serve frequently-requested, public data
 * (e.g. creator profiles, explore lists, trending creators).
 */

/**
 * Set public cache headers — shared by CDN / proxy caches AND the browser.
 * @param {number} seconds  max-age in seconds (default 60)
 */
const cachePublic = (seconds = 60) => (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
    next();
};

/**
 * Set private cache headers — browser only, not cached by proxies.
 * @param {number} seconds  max-age in seconds (default 60)
 */
const cachePrivate = (seconds = 60) => (_req, res, next) => {
    res.set('Cache-Control', `private, max-age=${seconds}`);
    next();
};

/**
 * Prevent any caching.
 */
const noCache = () => (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

module.exports = { cachePublic, cachePrivate, noCache };
