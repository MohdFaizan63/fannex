const ProfileView = require('../models/ProfileView');
const Payment = require('../models/Payment');
const CreatorProfile = require('../models/CreatorProfile');
const Earnings = require('../models/Earnings');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns { start, end, groupFormat } based on range query param */
function getDateRange(range) {
    const now = new Date();
    let start, groupFormat;

    switch (range) {
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);          // Jan 1 this year
            groupFormat = '%Y-%m';                                // group by month
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of this month
            groupFormat = '%Y-%m-%d';                             // group by day
            break;
        case 'week':
        default: {
            const day = now.getDay(); // 0=Sun
            start = new Date(now);
            start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); // Monday
            start.setHours(0, 0, 0, 0);
            groupFormat = '%Y-%m-%d';                             // group by day
            break;
        }
    }

    return { start, end: now, groupFormat };
}

/** Fill missing dates with 0 so charts look continuous */
function fillGaps(data, start, end, range) {
    const map = {};
    data.forEach(d => { map[d.date] = d.value; });

    const results = [];
    const cursor = new Date(start);

    if (range === 'year') {
        // iterate month by month
        while (cursor <= end) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            results.push({ date: key, value: map[key] || 0 });
            cursor.setMonth(cursor.getMonth() + 1);
        }
    } else {
        // iterate day by day
        while (cursor <= end) {
            const key = cursor.toISOString().slice(0, 10);
            results.push({ date: key, value: map[key] || 0 });
            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get profile view analytics
// @route   GET /api/v1/creator/insights/profile-views?range=week|month|year
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const getProfileViews = async (req, res, next) => {
    try {
        const range = req.query.range || 'week';
        const { start, end, groupFormat } = getDateRange(range);

        const pipeline = [
            { $match: { creatorId: req.user._id, createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
                    value: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', value: 1 } },
        ];

        const raw = await ProfileView.aggregate(pipeline);
        const filled = fillGaps(raw, start, end, range);
        const total = filled.reduce((s, d) => s + d.value, 0);

        res.json({
            success: true,
            data: {
                total,
                range,
                startDate: start.toISOString().slice(0, 10),
                endDate: end.toISOString().slice(0, 10),
                dataPoints: filled,
            },
        });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get earnings analytics (from Payment model)
// @route   GET /api/v1/creator/insights/earnings?range=week|month|year
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const getEarningsInsights = async (req, res, next) => {
    try {
        const range = req.query.range || 'week';
        const { start, end, groupFormat } = getDateRange(range);

        const pipeline = [
            {
                $match: {
                    creatorId: req.user._id,
                    status: 'captured',
                    createdAt: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
                    value: { $sum: '$amount' },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', value: 1 } },
        ];

        const raw = await Payment.aggregate(pipeline);
        const filled = fillGaps(raw, start, end, range);
        const total = filled.reduce((s, d) => s + d.value, 0);

        res.json({
            success: true,
            data: {
                total,
                range,
                startDate: start.toISOString().slice(0, 10),
                endDate: end.toISOString().slice(0, 10),
                dataPoints: filled,
            },
        });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get overview stats
// @route   GET /api/v1/creator/insights/overview
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const getOverview = async (req, res, next) => {
    try {
        const [totalViews, profile, earnings] = await Promise.all([
            ProfileView.countDocuments({ creatorId: req.user._id }),
            CreatorProfile.findOne({ userId: req.user._id }).lean(),
            Earnings.findOne({ creatorId: req.user._id }).lean(),
        ]);

        res.json({
            success: true,
            data: {
                totalViews,
                totalEarnings: earnings?.totalEarned ?? 0,
                pendingPayout: earnings?.pendingAmount ?? 0,
                totalSubscribers: profile?.totalSubscribers ?? 0,
                totalPosts: profile?.totalPosts ?? 0,
            },
        });
    } catch (err) { next(err); }
};

module.exports = { getProfileViews, getEarningsInsights, getOverview };
