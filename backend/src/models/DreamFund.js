const mongoose = require('mongoose');

const dreamFundSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: '',
        },
        targetAmount: {
            type: Number,
            required: true,
            min: 1,
            max: 5000000,
        },
        currentAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        image: {
            type: String,
            default: null,
        },
        // pending → approved/rejected → (fan contributes) → completed → awaiting_verification → verified
        status: {
            type: String,
            // Flow: pending → approved/rejected → completed (auto when target met) → paid (admin marks)
            // awaiting_verification / verified kept for backward compat only
            enum: ['pending', 'approved', 'rejected', 'completed', 'awaiting_verification', 'verified', 'paid'],
            default: 'pending',
            index: true,
        },
        paidAt: { type: Date, default: null },
        paidBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectionReason: {
            type: String,
            default: '',
        },
        proof: {
            url:  { type: String, default: null },
            type: { type: String, enum: ['image', 'video', null], default: null },
        },
        // Admin who actioned this
        actionedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Efficient queries for a creator's goals and admin listing
dreamFundSchema.index({ creatorId: 1, status: 1 });
dreamFundSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DreamFund', dreamFundSchema);
