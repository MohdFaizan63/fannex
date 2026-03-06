/**
 * HTTP Parameter Pollution protection — Express 5 compatible.
 *
 * The `hpp` npm package crashes on Express 5 because it tries to
 * reassign req.query (getter-only).
 *
 * This middleware sanitises req.body only — for each key, if the value
 * is an unexpected array, it takes the last element (same behaviour as
 * the original hpp package).
 */

const hppProtect = (req, _res, next) => {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        for (const key of Object.keys(req.body)) {
            if (Array.isArray(req.body[key])) {
                req.body[key] = req.body[key][req.body[key].length - 1];
            }
        }
    }
    next();
};

module.exports = hppProtect;
