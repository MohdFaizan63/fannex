const Post = require('../models/Post');
const PostLike = require('../models/PostLike');
const PostComment = require('../models/PostComment');
const Subscription = require('../models/Subscription');
const paginate = require('../utils/paginate');
const { optimizeMediaUrls, getVideoThumbnailUrl } = require('../utils/optimizeMediaUrl');
const { createNotification, notifySubscribers } = require('../services/notificationService');

// ── Helper: check active subscription or self ──────────────────────────────────
const checkSubscription = async (userId, creatorId) => {
    // Creator can always interact with their own posts
    if (userId.toString() === creatorId.toString()) return true;

    const sub = await Subscription.findOne({
        userId,
        creatorId,
        status: 'active',
        expiresAt: { $gt: new Date() },
    });
    return !!sub;
};

// @desc    Create a new post (creator only) — supports single file or multi-image album
// @route   POST /api/posts
// @access  Private (creator)
const createPost = async (req, res, next) => {
    try {
        // Support both req.files (array) and req.file (single)
        const files = req.files || (req.file ? [req.file] : []);
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: 'Please upload at least one media file' });
        }

        const { caption, isLocked } = req.body;

        const hasCloudinary =
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET;

        const mediaUrls = [];
        const mediaPublicIds = [];

        for (const file of files) {
            const url = hasCloudinary
                ? file.path
                : `${process.env.API_BASE_URL || 'http://localhost:8080'}/uploads/${file.filename}`;
            const publicId = hasCloudinary
                ? (file.filename || file.public_id || '')
                : file.filename;

            mediaUrls.push(url);
            mediaPublicIds.push(publicId);
        }

        // Determine media type
        const firstMime = files[0].mimetype;
        let mediaType = 'image';
        if (firstMime.startsWith('video/')) {
            mediaType = 'video';
        } else if (files.length > 1) {
            mediaType = 'album';
        }

        const post = await Post.create({
            creatorId: req.user._id,
            caption: caption || '',
            mediaUrls,
            mediaPublicIds,
            mediaType,
            isLocked: isLocked === 'true' || isLocked === true,
        });

        // Fire-and-forget notification to all subscribers
        notifySubscribers(req.user._id, {
            type: 'new_post',
            title: `${req.user.name} posted new content`,
            body: caption ? caption.slice(0, 100) : 'New content is available!',
            referenceId: post._id,
            referenceModel: 'Post',
        }).catch(() => { });

        res.status(201).json({ success: true, data: post });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all posts by a creator (paginated + searchable)
// @route   GET /api/posts/creator/:creatorId
// @access  Public (locked content hidden for non-subscribers)
const getPostsByCreator = async (req, res, next) => {
    try {
        const { page, limit, sort, search } = req.query;
        const creatorId = req.params.creatorId;

        // Check if current user is subscribed
        let userIsSubscribed = false;
        if (req.user) {
            userIsSubscribed = await checkSubscription(req.user._id, creatorId);
        }

        const { results, ...meta } = await paginate(
            Post,
            { creatorId },
            { page, limit, sort: sort || '-createdAt', searchField: 'caption', searchQuery: search }
        );

        // Attach whether the current user has liked each post
        let likedPostIds = new Set();
        if (req.user) {
            const postIds = results.map((p) => p._id);
            const likes = await PostLike.find({
                userId: req.user._id,
                postId: { $in: postIds },
            }).lean();
            likedPostIds = new Set(likes.map((l) => l.postId.toString()));
        }

        let sanitized = results.map((p) => ({
            ...p,
            isLocked: !!p.isLocked,
            isLiked: likedPostIds.has(p._id.toString()),
            mediaUrls: optimizeMediaUrls(p.mediaUrls, p.mediaType),
            thumbnailUrl: p.mediaType === 'video' ? getVideoThumbnailUrl(p.mediaUrls?.[0]) : undefined,
        }));

        // ── Free-preview for non-subscribers ────────────────────────────────
        // Only the latest 2 free posts are shown normally.
        // ALL other posts (both originally-locked AND free posts beyond the 2)
        // are marked as locked so the frontend blurs them.
        if (!userIsSubscribed) {
            const freePosts = sanitized.filter((p) => !p.isLocked);
            const lockedPosts = sanitized.filter((p) => p.isLocked);
            // Latest 2 free posts stay visible
            const previewPosts = freePosts.slice(0, 2);
            // Remaining free posts get locked for non-subscribers
            const remainingFree = freePosts.slice(2).map((p) => ({ ...p, isLocked: true }));
            sanitized = [...previewPosts, ...remainingFree, ...lockedPosts];
        }

        res.status(200).json({ success: true, results: sanitized, ...meta });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public / Private based on isLocked
const getPost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id).populate('creatorId', 'name email');
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        let isLiked = false;
        if (req.user) {
            const like = await PostLike.findOne({ userId: req.user._id, postId: post._id });
            isLiked = !!like;
        }

        const postObj = post.toObject();
        postObj.mediaUrls = optimizeMediaUrls(postObj.mediaUrls, postObj.mediaType);
        if (postObj.mediaType === 'video') {
            postObj.thumbnailUrl = getVideoThumbnailUrl(postObj.mediaUrls?.[0]);
        }

        res.status(200).json({ success: true, data: { ...postObj, isLiked } });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a post and remove media from Cloudinary
// @route   DELETE /api/posts/:id
// @access  Private (creator, post owner)
const deletePost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        if (post.creatorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
        }

        // Remove all assets from Cloudinary
        const publicIds = post.mediaPublicIds || [];
        if (publicIds.length > 0) {
            try {
                const cloudinary = require('cloudinary').v2;
                const resourceType = post.mediaType === 'video' ? 'video' : 'image';
                await Promise.all(
                    publicIds.map((pid) =>
                        cloudinary.uploader.destroy(pid, { resource_type: resourceType }).catch(() => { })
                    )
                );
            } catch (_) { /* ignore if cloudinary not configured */ }
        }

        // Clean up related likes and comments
        await Promise.all([
            PostLike.deleteMany({ postId: post._id }),
            PostComment.deleteMany({ postId: post._id }),
            post.deleteOne(),
        ]);

        res.status(200).json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle like/unlike on a post
// @route   POST /api/posts/:postId/like
// @access  Private (subscribed users)
const toggleLike = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        // Subscription check
        const allowed = await checkSubscription(req.user._id, post.creatorId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'Subscribe to interact with this creator',
                requiresSubscription: true,
            });
        }

        const existing = await PostLike.findOne({ userId: req.user._id, postId: post._id });

        if (existing) {
            // Unlike
            await existing.deleteOne();
            await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } });
            return res.status(200).json({
                success: true,
                liked: false,
                likesCount: Math.max(0, (post.likesCount || 0) - 1),
            });
        }

        // Like
        await PostLike.create({
            userId: req.user._id,
            postId: post._id,
            creatorId: post.creatorId,
        });
        await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } });

        res.status(200).json({
            success: true,
            liked: true,
            likesCount: (post.likesCount || 0) + 1,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a comment to a post
// @route   POST /api/posts/:postId/comments
// @access  Private (subscribed users)
const addComment = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        const allowed = await checkSubscription(req.user._id, post.creatorId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'Subscribe to interact with this creator',
                requiresSubscription: true,
            });
        }

        const { commentText, parentId } = req.body;
        if (!commentText || !commentText.trim()) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        // If replying, verify parent comment exists and belongs to same post
        if (parentId) {
            const parent = await PostComment.findOne({ _id: parentId, postId: post._id });
            if (!parent) {
                return res.status(400).json({ success: false, message: 'Parent comment not found' });
            }
        }

        const comment = await PostComment.create({
            userId: req.user._id,
            postId: post._id,
            creatorId: post.creatorId,
            commentText: commentText.trim(),
            parentId: parentId || null,
        });

        await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });

        // Notify parent comment author when someone replies
        if (parentId) {
            const parent = await PostComment.findById(parentId).select('userId').lean();
            if (parent) {
                createNotification({
                    recipientId: parent.userId,
                    senderId: req.user._id,
                    type: 'comment_reply',
                    title: `${req.user.name} replied to your comment`,
                    body: commentText.trim().slice(0, 100),
                    referenceId: post._id,
                    referenceModel: 'Post',
                }).catch(() => { });
            }
        }

        // Populate user info before returning
        const populated = await PostComment.findById(comment._id)
            .populate('userId', 'name')
            .lean();

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get comments for a post (paginated)
// @route   GET /api/posts/:postId/comments
// @access  Public
const getComments = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        // Get top-level comments only (parentId is null)
        const filter = { postId: post._id, parentId: null };

        const [comments, totalResults] = await Promise.all([
            PostComment.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name')
                .lean(),
            PostComment.countDocuments(filter),
        ]);

        // Fetch replies for each top-level comment
        const commentIds = comments.map((c) => c._id);
        const replies = await PostComment.find({ parentId: { $in: commentIds } })
            .sort({ createdAt: 1 })
            .populate('userId', 'name')
            .lean();

        // Group replies by parent
        const repliesMap = {};
        replies.forEach((r) => {
            const pid = r.parentId.toString();
            if (!repliesMap[pid]) repliesMap[pid] = [];
            repliesMap[pid].push(r);
        });

        const commentsWithReplies = comments.map((c) => ({
            ...c,
            replies: repliesMap[c._id.toString()] || [],
        }));

        res.status(200).json({
            success: true,
            results: commentsWithReplies,
            page,
            totalPages: Math.ceil(totalResults / limit),
            totalResults,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a comment (author or creator can delete)
// @route   DELETE /api/posts/comments/:commentId
// @access  Private
const deleteComment = async (req, res, next) => {
    try {
        const comment = await PostComment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        // Only comment author or the creator of the post can delete
        const isAuthor = comment.userId.toString() === req.user._id.toString();
        const isCreator = comment.creatorId.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isAuthor && !isCreator && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
        }

        // Delete the comment and any replies
        const deletedIds = [comment._id];
        const childReplies = await PostComment.find({ parentId: comment._id });
        deletedIds.push(...childReplies.map((r) => r._id));

        await PostComment.deleteMany({ _id: { $in: deletedIds } });
        await Post.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -deletedIds.length } });

        res.status(200).json({ success: true, message: 'Comment deleted', deletedCount: deletedIds.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle hide/unhide a comment (creator moderation)
// @route   PATCH /api/posts/comments/:commentId/hide
// @access  Private (creator, admin)
const toggleHideComment = async (req, res, next) => {
    try {
        const comment = await PostComment.findById(req.params.commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        // Only the creator of the post or admin can hide
        const isCreator = comment.creatorId.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        comment.isHidden = !comment.isHidden;
        await comment.save();

        res.status(200).json({ success: true, isHidden: comment.isHidden });
    } catch (error) {
        next(error);
    }
};

// @desc    Get post engagement stats for creator's own posts
// @route   GET /api/posts/engagement/my-posts
// @access  Private (creator, admin)
const getPostEngagement = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const filter = { creatorId: req.user._id };

        const [posts, totalResults] = await Promise.all([
            Post.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments(filter),
        ]);

        // Fetch latest 3 comments per post
        const postIds = posts.map((p) => p._id);
        const latestComments = await PostComment.aggregate([
            { $match: { postId: { $in: postIds }, isHidden: false } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$postId', comments: { $push: '$$ROOT' } } },
            { $project: { comments: { $slice: ['$comments', 3] } } },
        ]);

        // Populate user info for comments
        const allCommentIds = latestComments.flatMap((g) => g.comments.map((c) => c._id));
        const populatedComments = await PostComment.find({ _id: { $in: allCommentIds } })
            .populate('userId', 'name')
            .lean();

        const commentMap = {};
        populatedComments.forEach((c) => { commentMap[c._id.toString()] = c; });

        const commentsMap = {};
        latestComments.forEach((g) => {
            commentsMap[g._id.toString()] = g.comments.map((c) => commentMap[c._id.toString()] || c);
        });

        const enriched = posts.map((p) => ({
            ...p,
            latestComments: commentsMap[p._id.toString()] || [],
        }));

        res.status(200).json({
            success: true,
            results: enriched,
            page,
            totalPages: Math.ceil(totalResults / limit),
            totalResults,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update caption of a post
// @route   PATCH /api/posts/:id/caption
// @access  Private (post owner)
const updateCaption = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
        if (post.creatorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }
        post.caption = req.body.caption ?? '';
        await post.save();
        res.status(200).json({ success: true, data: post });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPost,
    getPostsByCreator,
    getPost,
    deletePost,
    toggleLike,
    addComment,
    getComments,
    deleteComment,
    toggleHideComment,
    getPostEngagement,
    updateCaption,
};
