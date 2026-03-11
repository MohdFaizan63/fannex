const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        isPaid: { type: Boolean, default: false },
        chatPaymentId: { type: String, default: '' }, // Cashfree cf_payment_id that unlocked this room
        unlockedAt: { type: Date },

        // Denormalised for inbox performance
        lastMessage: { type: String, default: '' },
        lastMessageAt: { type: Date },
        lastMessageType: { type: String, enum: ['text', 'image', 'voice', 'gift'], default: 'text' },

        // Unread counters
        unreadByCreator: { type: Number, default: 0 },
        unreadByUser: { type: Number, default: 0 },

        // Soft-delete
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Ensure one room per (creator, user) pair
chatRoomSchema.index({ creatorId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
