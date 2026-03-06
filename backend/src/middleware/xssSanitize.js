/**
 * Lightweight XSS sanitizer — Express 5 compatible.
 *
 * xss-clean npm package crashes on Express 5 because it tries to
 * reassign req.query (which is a getter-only property in Express 5).
 *
 * This middleware sanitises req.body and req.params only.
 */

const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_ATTR_RE = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_RE = /javascript\s*:/gi;

/**
 * Recursively sanitise all string values in an object.
 */
const sanitize = (obj) => {
    if (typeof obj === 'string') {
        return obj
            .replace(SCRIPT_RE, '')
            .replace(EVENT_ATTR_RE, '')
            .replace(DANGEROUS_RE, '');
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const key of Object.keys(obj)) {
            cleaned[key] = sanitize(obj[key]);
        }
        return cleaned;
    }
    return obj;
};

const xssSanitize = (req, _res, next) => {
    if (req.body) req.body = sanitize(req.body);
    if (req.params) {
        // req.params is writable in Express 5
        for (const key of Object.keys(req.params)) {
            if (typeof req.params[key] === 'string') {
                req.params[key] = sanitize(req.params[key]);
            }
        }
    }
    next();
};

module.exports = xssSanitize;
