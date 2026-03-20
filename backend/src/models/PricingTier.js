const mongoose = require('mongoose');

/**
 * PricingTier — DB-backed geo pricing bands
 *
 * Each document maps a creator's base INR subscription price range
 * to a fixed USD display price for international (non-IN) users.
 *
 * Admins can update these tiers at any time without a code deploy.
 * The seed script (scripts/seedPricingTiers.js) populates defaults.
 */
const pricingTierSchema = new mongoose.Schema(
    {
        // "US" = United States, "ROW" = rest of world (non-IN, non-US)
        // Currently both US and ROW map to the same USD bands.
        // Extend with more regions (e.g. "EU", "UK") here in the future.
        region: {
            type: String,
            enum: ['US', 'ROW'],
            required: true,
            default: 'ROW',
        },

        // INR base-price window (creator's subscriptionPrice)
        minInr: { type: Number, required: true, min: 0 },
        // null = no upper bound (catches ₹X–∞ bands)
        maxInr: { type: Number, default: null },

        // Fixed USD display price (psychological pricing already applied)
        usdPrice: { type: Number, required: true, min: 0 },

        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Admin will query "active tiers ordered by minInr" frequently
pricingTierSchema.index({ region: 1, minInr: 1 });

module.exports = mongoose.model('PricingTier', pricingTierSchema);
