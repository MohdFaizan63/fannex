const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'ChatRoom',
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        type: {
            type: String,
            enum: ['text', 'image', 'voice', 'gift'],
            default: 'text',
        },
        content: { type: String, default: '' },   // text body or media URL
        giftAmount: { type: Number, default: 0 }, // only for type=gift
        giftPaymentId: { type: String, default: '' }, // Cashfree cf_payment_id for the gift

        seen: { type: Boolean, default: false },
        seenAt: { type: Date },
    },
    { timestamps: true }
);

// Fast fetch of messages for a room ordered by time
chatMessageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
