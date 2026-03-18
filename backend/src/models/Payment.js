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

        // ── Idempotency flags ──────────────────────────────────────────────────
        // _earningsCredited: legacy flag (kept for backward compat)
        // sideEffectsDone:   NEW bulletproof flag — set atomically to true by the
        //   first caller (webhook OR verify) that wins the "claim" race.
        //   All subsequent callers see true and skip side effects entirely.
        //   Prevents double-counting of earnings, subscriber counts, chat unlock.
        _earningsCredited: { type: Boolean, default: false },
        sideEffectsDone:   { type: Boolean, default: false, index: true },

        // ── Legacy Razorpay fields (kept for historical records — do NOT use) ──
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        razorpaySubscriptionId: { type: String },
        // ── GST & fee breakdown (added for Indian tax compliance) ─────────────
        // baseAmount    = creator-set price before GST
        // gstAmount     = 18% GST collected from fan
        // platformFee   = 20% of baseAmount (platform revenue)
        // creatorEarning = 80% of baseAmount (credited to creator dashboard)
        // amount        = baseAmount + gstAmount (total fan paid, stored above)
        baseAmount:     { type: Number, default: 0 },
        gstAmount:      { type: Number, default: 0 },
        platformFee:    { type: Number, default: 0 },
        creatorEarning: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Compound index for wallet history query (userId + type + status + sorted by date)
paymentSchema.index({ userId: 1, type: 1, status: 1, createdAt: -1 });

// ── Earnings aggregation indexes ──────────────────────────────────────────────
// getEarningsHistory $facet: matches creatorId + status, sorts by createdAt, groups by type
paymentSchema.index({ creatorId: 1, status: 1, type: 1, createdAt: -1 });
// Sum aggregation for Earnings reconciliation (creatorId + status + creatorEarning)
paymentSchema.index({ creatorId: 1, status: 1, creatorEarning: 1 });
// cfOrderId already has index:true defined on the field itself — no need for a separate index here


module.exports = mongoose.model('Payment', paymentSchema);
