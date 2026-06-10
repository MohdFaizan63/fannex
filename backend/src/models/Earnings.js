const mongoose = require('mongoose');

const earningsSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,   // one earnings ledger per creator
            index: true,
        },
        totalEarned: {
            type: Number,
            default: 0,
            min: 0,
        },
        pendingAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        withdrawnAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        // ── Admin override fields ──────────────────────────────────────────────
        // When set by admin, these take precedence over the live Payment aggregation
        // in getCreatorDetail. Set to null to revert to live computation.
        overrideTotalEarned: {
            type: Number,
            default: null,
            min: 0,
        },
        overridePendingAmount: {
            type: Number,
            default: null,
            min: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Earnings', earningsSchema);

