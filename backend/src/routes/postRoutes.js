const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/postController');
const { protect, authorize, optionalProtect } = require('../middleware/authMiddleware');
const { upload, validateFileSizes } = require('../middleware/uploadMiddleware');
const { validate } = require('../validators/validate');
const { createPostSchema } = require('../validators/postValidators');

// ── Public routes ──────────────────────────────────────────────────────────────
router.get('/creator/:creatorId', optionalProtect, getPostsByCreator);
router.get('/:id', optionalProtect, getPost);

// ── Comments (public read) ─────────────────────────────────────────────────────
router.get('/:postId/comments', getComments);

// ── Protected routes ───────────────────────────────────────────────────────────
router.post(
    '/',
    protect,
    authorize('creator', 'admin'),
    upload.array('media', 10),
    validateFileSizes,
    validate(createPostSchema),
    createPost
);

router.delete('/:id', protect, authorize('creator', 'admin'), deletePost);
router.patch('/:id/caption', protect, authorize('creator', 'admin'), updateCaption);

// ── Like / Comment (subscribers) ───────────────────────────────────────────────
router.post('/:postId/like', protect, toggleLike);
router.post('/:postId/comments', protect, addComment);

// ── Comment moderation ─────────────────────────────────────────────────────────
router.delete('/comments/:commentId', protect, deleteComment);
router.patch('/comments/:commentId/hide', protect, toggleHideComment);

// ── Creator engagement analytics ───────────────────────────────────────────────
router.get('/engagement/my-posts', protect, authorize('creator', 'admin'), getPostEngagement);

module.exports = router;
