const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'active', 'canceled', 'expired'],
            default: 'active'
        },
        expiresAt: {
            type: Date,
            required: true
        },
        // Legacy Razorpay/Stripe fields kept as sparse index for old records
        // (no longer created for new subscriptions)
        cfOrderId: { type: String, default: null },
        // ── Multi-plan subscription fields ────────────────────────────────────
        planDuration:        { type: Number, enum: [1, 3, 6, 12], default: 1 },
        discountPercentage:  { type: Number, default: 0 },
        discountedPrice:     { type: Number, default: 0 },
        taxAmount:           { type: Number, default: 0 },
        totalPaid:           { type: Number, default: 0 },
        baseMonthlyPrice:    { type: Number, default: 0 },
    },
    { timestamps: true }
);

// ── Database-level uniqueness guarantee ────────────────────────────────────────
// CRITICAL: unique:true prevents MongoDB from ever creating two Subscription
// documents for the same (userId, creatorId) pair. Without this, a race condition
// between the webhook and the /verify endpoint could insert two rows, showing the
// same creator twice on the "My Subscriptions" page.
//
// The previous findOneAndUpdate upserts relied on a query match to prevent dups,
// but if the doc didn't exist yet, two concurrent upserts would both "win" and
// insert two rows. This unique index makes the second upsert throw E11000, which
// Mongoose silently ignores (upsert semantics), leaving only one doc.
subscriptionSchema.index({ userId: 1, creatorId: 1 }, { unique: true });

// Supporting indexes for common query patterns
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ creatorId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
