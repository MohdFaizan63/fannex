const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        type: {
            type: String,
            enum: ['subscription', 'chat_unlock', 'gift', 'wallet'],
            default: 'subscription',
        },
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatRoom',
            default: null,
        },
        giftAmount: { type: Number, default: 0 },

        status: {
            type: String,
            enum: ['created', 'captured', 'failed', 'refunded'],
            default: 'created',
        },

        // ── Cashfree fields ────────────────────────────────────────────────────
        cfOrderId: { type: String, index: true },
        cfPaymentId: { type: String },

        // ── Idempotency flag (BUG-5 fix) ──────────────────────────────────────
        // Set to true once creator earnings have been credited for this payment.
        // Prevents double-credit on concurrent gift verify calls.
        _earningsCredited: { type: Boolean, default: false },

        // ── Legacy Razorpay fields (kept for historical records — do NOT use) ──
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        razorpaySubscriptionId: { type: String },
    },
    { timestamps: true }
);

// Compound index for wallet history query (userId + type + status + sorted by date)
paymentSchema.index({ userId: 1, type: 1, status: 1, createdAt: -1 });
// Idempotency: fast lookup by Cashfree order ID
paymentSchema.index({ cfOrderId: 1 }, { unique: false, sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);
