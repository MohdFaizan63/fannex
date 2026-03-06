const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true
        },
        caption: {
            type: String,
            default: ''
        },
        // ── Media (supports single image/video and multi-image albums) ──────
        mediaUrls: {
            type: [String],
            default: [],
        },
        mediaPublicIds: {
            type: [String],
            default: [],
        },
        mediaType: {
            type: String,
            enum: ['image', 'video', 'album'],
            default: 'image',
        },
        isLocked: {
            type: Boolean,
            default: true
        },
        likesCount: {
            type: Number,
            default: 0
        },
        commentsCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Backward-compat virtual: mediaUrl returns first URL ─────────────────────
postSchema.virtual('mediaUrl').get(function () {
    return this.mediaUrls?.[0] || '';
});

postSchema.virtual('mediaPublicId').get(function () {
    return this.mediaPublicIds?.[0] || '';
});

// Compound index for paginated creator post queries
postSchema.index({ creatorId: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
