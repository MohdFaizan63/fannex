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
            required: true,
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
            enum: ['subscription', 'chat_unlock', 'gift'],
            default: 'subscription',
        },
        // For chat_unlock and gift payments
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
        razorpayOrderId: {
            type: String,
            index: true,
        },
        razorpayPaymentId: {
            type: String,
        },
        razorpaySignature: {
            type: String,
        },
        razorpaySubscriptionId: {
            type: String,
            index: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
