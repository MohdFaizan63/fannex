const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        visitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        // Normalised calendar date (YYYY-MM-DD) used for deduplication
        dateKey: {
            type: String,
            default: () => new Date().toISOString().slice(0, 10),
        },
    },
    { timestamps: true }
);

// ── BUG-15 FIX: Deduplication per (creator, visitor, day) ─────────────────────
// A logged-in user will only generate ONE view record per creator per calendar day.
// anonymous visitors (visitorId=null) are NOT deduplicated — analytics can aggregate by dateKey.
profileViewSchema.index(
    { creatorId: 1, visitorId: 1, dateKey: 1 },
    {
        unique: true,
        partialFilterExpression: { visitorId: { $ne: null } }, // only deduplicate logged-in users
        name: 'unique_view_per_user_per_day',
    }
);

// Compound index for fast date-range aggregation
profileViewSchema.index({ creatorId: 1, createdAt: -1 });

// ── TTL: auto-purge view records older than 90 days ───────────────────────────
profileViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'ttl_90_days' });

module.exports = mongoose.model('ProfileView', profileViewSchema);
