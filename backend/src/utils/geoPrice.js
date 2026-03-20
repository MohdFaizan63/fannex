/**
 * geoPrice.js — Pure geo-pricing utility (no I/O)
 *
 * IMPORTANT: All pricing decisions are made server-side.
 * Never trust the frontend for price calculation.
 */

/**
 * Round a numeric USD price to the nearest psychological ending.
 * e.g. 5.21 → 5.99, 2.58 → 2.99, 10.43 → 10.99
 */
function roundToPsychologicalPrice(raw) {
    const floor = Math.floor(raw);
    // If the raw price is already .99 exactly, leave it
    if (raw === floor + 0.99) return raw;
    // Always round to X.99
    return floor + 0.99;
}

/**
 * Get the display price for a creator subscription based on visitor country.
 *
 * @param {number}  basePriceInr  Creator's base monthly subscription price in INR
 * @param {string}  country       ISO 3166-1 alpha-2 country code (e.g. "IN", "US", "DE")
 * @param {Array}   tiers         Active PricingTier documents from DB (already fetched by caller)
 * @returns {{ price: number, currency: "INR"|"USD", region: string, original_price_inr: number }}
 */
function getDisplayPrice(basePriceInr, country, tiers = []) {
    const base = Number(basePriceInr) || 0;
    const cc = (country || 'IN').toUpperCase().trim();

    // ── Indian user: always show INR price ──────────────────────────────────
    if (cc === 'IN') {
        return {
            original_price_inr: base,
            final_price: base,
            currency: 'INR',
            region: 'IN',
            country: cc,
        };
    }

    // ── International user: map to USD pricing band ──────────────────────────
    // US and ROW currently share the same band table.
    const region = cc === 'US' ? 'US' : 'ROW';

    // Filter active tiers that match the region (also accept ROW tiers as fallback for US)
    const activeTiers = tiers.filter(
        (t) => t.active && (t.region === region || t.region === 'ROW')
    );

    // Sort ascending by minInr so we find the correct band
    activeTiers.sort((a, b) => a.minInr - b.minInr);

    const matched = activeTiers.find((t) => {
        const aboveMin = base >= t.minInr;
        const belowMax = t.maxInr === null || t.maxInr === undefined || base <= t.maxInr;
        return aboveMin && belowMax;
    });

    if (matched) {
        return {
            original_price_inr: base,
            final_price: matched.usdPrice,
            currency: 'USD',
            region,
            country: cc,
        };
    }

    // ── Hardcoded fallback (tiers table empty or no match) ───────────────────
    // Dynamic fallback: multiply by 2x and convert at ~85 INR/USD, then round
    const rawUsd = (base * 2) / 85;
    const fallbackPrice = activeTiers.length === 0 && base > 0
        ? roundToPsychologicalPrice(rawUsd)
        : 4.99; // safe minimum

    return {
        original_price_inr: base,
        final_price: fallbackPrice,
        currency: 'USD',
        region,
        country: cc,
    };
}

module.exports = { getDisplayPrice, roundToPsychologicalPrice };
