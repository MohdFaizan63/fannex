/**
 * geoMiddleware.js — Attach req.country from request context
 *
 * Resolution order (fastest to slowest):
 *  1. X-Country-Code header  (manual override, useful for testing)
 *  2. CF-IPCountry header    (Cloudflare CDN — already set in production, fastest)
 *  3. ipapi.co API           (free, used only in local dev / non-CF environments)
 *  4. Default "IN"           (safe fallback for India-primary platform)
 *
 * This middleware is intentionally lightweight & non-blocking.
 * It will NEVER crash a request — any failure falls through to the "IN" default.
 */

const axios = require('axios');

// Simple in-memory cache to avoid hammering ipapi.co repeatedly for the same IP
// (TTL: 5 minutes per IP)
const ipCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function lookupCountryByIp(ip) {
    // Skip loopback / private IP ranges — ipapi.co can't handle them
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return null;
    }

    const cached = ipCache.get(ip);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.country;
    }

    try {
        const { data } = await axios.get(`https://ipapi.co/${ip}/country/`, {
            timeout: 2000, // 2-second hard timeout
        });
        const country = (data || '').toString().trim().toUpperCase();
        if (country && country.length === 2) {
            ipCache.set(ip, { country, ts: Date.now() });
            return country;
        }
    } catch {
        // Silently swallow — fallback to default below
    }
    return null;
}

const geoMiddleware = async (req, res, next) => {
    try {
        // 1. Manual override (great for testing without VPN)
        const override = req.headers['x-country-code'];
        if (override && typeof override === 'string' && override.length === 2) {
            req.country = override.toUpperCase().trim();
            return next();
        }

        // 2. Cloudflare header (production — zero latency)
        const cfCountry = req.headers['cf-ipcountry'];
        if (cfCountry && cfCountry !== 'XX' && cfCountry.length === 2) {
            req.country = cfCountry.toUpperCase().trim();
            return next();
        }

        // 3. IP lookup (dev / non-Cloudflare)
        const ip = req.ip || req.socket?.remoteAddress;
        const lookedUp = await lookupCountryByIp(ip);
        if (lookedUp) {
            req.country = lookedUp;
            return next();
        }

    } catch {
        // Safety catch-all
    }

    // 4. Default to India (safest default for this platform)
    req.country = 'IN';
    next();
};

module.exports = geoMiddleware;
