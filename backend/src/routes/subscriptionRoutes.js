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
        const userId = req.user._id;

        // Aggregate with dedup: group by creatorId, keep only the most recent active sub.
        // This is defense-in-depth — even if duplicate Subscription docs somehow exist
        // (race condition bug from before), only ONE card shows per creator.
        const subs = await Subscription.aggregate([
            { $match: { userId, status: 'active' } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$creatorId',                 // one row per creator
                    subId:     { $first: '$_id' },
                    status:    { $first: '$status' },
                    expiresAt: { $first: '$expiresAt' },
                    createdAt: { $first: '$createdAt' },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        // Enrich each unique subscription with creator profile data
        const enriched = await Promise.all(subs.map(async (sub) => {
            const profile = await CreatorProfile
                .findOne({ userId: sub._id })          // _id here is creatorId from group
                .select('displayName username profileImage profileImagePosition coverImage coverImagePosition subscriptionPrice userId')
                .lean();
            return {
                _id:       sub.subId,
                status:    sub.status,
                expiresAt: sub.expiresAt,
                createdAt: sub.createdAt,
                creator:   profile || null,
            };
        }));

        res.json({ success: true, data: enriched });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
