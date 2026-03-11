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
    },
    { timestamps: true }
);

// Compound indexes for common lookup patterns
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ creatorId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
