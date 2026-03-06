const mongoose = require('mongoose');

const earningsSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,   // one earnings ledger per creator
            index: true,
        },
        totalEarned: {
            type: Number,
            default: 0,
            min: 0,
        },
        pendingAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        withdrawnAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Earnings', earningsSchema);
