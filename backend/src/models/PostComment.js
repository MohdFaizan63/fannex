const mongoose = require('mongoose');

const postCommentSchema = new mongoose.Schema(
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
        commentText: {
            type: String,
            required: [true, 'Comment text is required'],
            maxlength: [1000, 'Comment cannot exceed 1000 characters'],
            trim: true,
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PostComment',
            default: null,
        },
        isHidden: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Efficient retrieval of comments per post, sorted by time
postCommentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('PostComment', postCommentSchema);
