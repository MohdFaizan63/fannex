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
        stripeSubscriptionId: {
            type: String
        }
    },
    { timestamps: true }
);

// Compound indexes for common lookup patterns
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ creatorId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
