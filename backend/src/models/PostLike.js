const mongoose = require('mongoose');

const postLikeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Post',
            index: true,
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
    },
    { timestamps: true }
);

// One like per user per post
postLikeSchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports = mongoose.model('PostLike', postLikeSchema);
