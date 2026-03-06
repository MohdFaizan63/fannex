const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Subscription = require('../models/Subscription');
const CreatorProfile = require('../models/CreatorProfile');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current user's active subscriptions with creator profile details
// @route   GET /api/v1/subscriptions/my
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', protect, async (req, res, next) => {
    try {
        const subs = await Subscription.find({ userId: req.user._id, status: 'active' })
            .sort('-createdAt')
            .lean();

        // For each subscription, fetch creator profile via creatorId (User._id)
        const enriched = await Promise.all(subs.map(async (sub) => {
            const profile = await CreatorProfile
                .findOne({ userId: sub.creatorId })
                .select('displayName username profileImage profileImagePosition coverImage coverImagePosition subscriptionPrice userId')
                .lean();
            return {
                _id: sub._id,
                status: sub.status,
                expiresAt: sub.expiresAt,
                createdAt: sub.createdAt,
                creator: profile || null,
            };
        }));

        res.json({ success: true, data: enriched });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
