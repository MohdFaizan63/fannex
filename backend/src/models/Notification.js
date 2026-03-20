const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        type: {
            type: String,
            required: true,
            enum: [
                'new_post', 'comment_reply', 'subscription_expiring', 'new_message',
                // Dream Fund lifecycle events
                'dream_fund_approved', 'dream_fund_rejected',
                'dream_fund_completed', 'dream_fund_proof_approved', 'dream_fund_proof_rejected',
            ],
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        body: {
            type: String,
            default: '',
            maxlength: 500,
        },
        // Reference to related document (post, comment, chat, subscription)
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        referenceModel: {
            type: String,
            enum: ['Post', 'PostComment', 'ChatRoom', 'Subscription', 'DreamFund'],
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Fast retrieval of a user's notifications, newest first
notificationSchema.index({ recipientId: 1, createdAt: -1 });
// Fast unread count
notificationSchema.index({ recipientId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
