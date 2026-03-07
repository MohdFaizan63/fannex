const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        visitorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

// Compound index for fast date-range aggregation
profileViewSchema.index({ creatorId: 1, createdAt: -1 });

module.exports = mongoose.model('ProfileView', profileViewSchema);
