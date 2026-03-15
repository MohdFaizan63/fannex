/**
 * GST Helper — Fannex
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all GST and platform-fee calculations.
 *
 * Rules:
 *  - GST Rate         : 18% of base price  (collected by platform for tax)
 *  - Platform Fee     : 20% of base price  (platform revenue)
 *  - Creator Earning  : 80% of base price  (credited to creator dashboard)
 *  - Fan Pays         : base + GST         (total amount charged via Cashfree)
 *
 * NOTE: Wallet top-ups are NOT subject to GST. Only content purchases are:
 *       subscriptions, chat unlocks, gifts, paid posts.
 */

const GST_RATE          = 0.18;   //  18%
const PLATFORM_FEE_RATE = 0.20;   //  20% of base → platform keeps
const CREATOR_RATE      = 0.80;   //  80% of base → creator earns

/**
 * Calculate GST breakdown for a given base price.
 *
 * @param {number} baseAmount  - The price set by the creator (INR, no GST)
 * @returns {{
 *   baseAmount:    number,   // original creator-set price
 *   gstAmount:     number,   // 18% of base (for tax records)
 *   totalPaid:     number,   // what the fan pays = base + GST
 *   platformFee:   number,   // 20% of base (platform revenue)
 *   creatorEarning:number,   // 80% of base (credited to creator)
 * }}
 */
const calcGST = (baseAmount) => {
    const base = Math.round(baseAmount * 100) / 100;

    const gstAmount      = Math.round(base * GST_RATE          * 100) / 100;
    const totalPaid      = Math.round((base + gstAmount)        * 100) / 100;
    const platformFee    = Math.round(base * PLATFORM_FEE_RATE  * 100) / 100;
    const creatorEarning = Math.round(base * CREATOR_RATE       * 100) / 100;

    return { baseAmount: base, gstAmount, totalPaid, platformFee, creatorEarning };
};

module.exports = { GST_RATE, PLATFORM_FEE_RATE, CREATOR_RATE, calcGST };
