const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: [true, 'Payout amount is required'],
            min: [1, 'Payout amount must be at least 1'],
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'paid'],
            default: 'pending',
            index: true,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
            index: true,  // Bug 8 Fix: indexes the sort field used in listPayoutsService
        },
        processedAt: {
            type: Date,
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',    // admin who acted on the request
            default: null,
        },
        notes: {
            type: String,   // optional admin note (e.g. rejection reason)
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
