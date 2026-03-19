const User = require('../models/User');
const Post = require('../models/Post');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const CreatorProfile = require('../models/CreatorProfile');
const CreatorVerification = require('../models/CreatorVerification');
const PayoutRequest = require('../models/PayoutRequest');
const Earnings = require('../models/Earnings');
const paginate = require('../utils/paginate');
const {
    approvePayoutService,
    markPayoutPaidService,
    rejectPayoutService,
    adminDirectPayoutService,
} = require('../services/earningsService');
const cloudinary = require('../config/cloudinary');
const { maskVerificationData } = require('../utils/maskData');

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all users (paginated + filterable)
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.isBanned !== undefined) filter.isBanned = req.query.isBanned === 'true';

        const data = await paginate(User, filter, {
            page: req.query.page,
            limit: req.query.limit,
            sort: req.query.sort || '-createdAt',
            searchField: 'name',
            searchQuery: req.query.search,
            select: '-password',
        });

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single user detail
// @route   GET /api/admin/users/:id
// @access  Admin
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// @desc    Ban a user
// @route   PUT /api/admin/users/:id/ban
// @access  Admin
const banUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (user.role === 'admin') {
            return res.status(400).json({ success: false, message: 'Cannot ban an admin account' });
        }

        user.isBanned = true;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({ success: true, message: `User ${user.email} has been banned` });
    } catch (error) {
        next(error);
    }
};

// @desc    Unban a user
// @route   PUT /api/admin/users/:id/unban
// @access  Admin
const unbanUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.isBanned = false;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({ success: true, message: `User ${user.email} has been unbanned` });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a user account permanently
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'admin') {
            return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
        }

        await user.deleteOne();
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all posts (paginated + searchable)
// @route   GET /api/admin/posts
// @access  Admin
const getAllPosts = async (req, res, next) => {
    try {
        const data = await paginate(Post, {}, {
            page: req.query.page,
            limit: req.query.limit,
            sort: req.query.sort || '-createdAt',
            searchField: 'caption',
            searchQuery: req.query.search,
            populate: { path: 'creatorId', select: 'name email' },
        });

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete any post (admin override)
// @route   DELETE /api/admin/posts/:id
// @access  Admin
const adminDeletePost = async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

        // Remove from Cloudinary
        if (post.mediaPublicId) {
            const resourceType = post.mediaType === 'video' ? 'video' : 'image';
            await cloudinary.uploader.destroy(post.mediaPublicId, { resource_type: resourceType });
        }

        await post.deleteOne();
        res.status(200).json({ success: true, message: 'Post deleted by admin' });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get subscription & revenue analytics
// @route   GET /api/admin/analytics
// @access  Admin
const getAnalytics = async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalCreators,
            bannedUsers,
            totalPosts,
            totalSubscriptions,
            canceledSubscriptions,
            pendingVerifications,
            revenueData,
            pendingPayouts,
            totalPayoutsData,
            topCreators,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'creator' }),
            User.countDocuments({ isBanned: true }),
            Post.countDocuments(),
            Subscription.countDocuments({ status: 'active' }),
            Subscription.countDocuments({ status: 'canceled' }),
            CreatorVerification.countDocuments({ status: 'pending' }),
            // Total revenue from payments
            Payment.aggregate([
                { $match: { status: 'captured' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            PayoutRequest.countDocuments({ status: { $in: ['pending', 'approved'] } }),
            // Total paid-out amount
            PayoutRequest.aggregate([
                { $match: { status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            CreatorProfile.find()
                .sort({ totalSubscribers: -1 })
                .limit(5)
                .populate('userId', 'name email'),
        ]);

        const totalRevenue = revenueData[0]?.total ?? 0;

        // Monthly revenue (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyRevenue = await Payment.aggregate([
            { $match: { status: 'captured', createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        res.status(200).json({
            success: true,
            data: {
                // Flat fields for stat cards
                totalUsers,
                totalCreators,
                pendingVerifications,
                totalPayouts: totalPayoutsData[0]?.total ?? 0,
                totalSubscriptions,
                totalPosts,
                bannedUsers,
                pendingPayouts,
                // Nested richer data
                users: { total: totalUsers, creators: totalCreators, banned: bannedUsers },
                content: { totalPosts },
                subscriptions: { active: totalSubscriptions, canceled: canceledSubscriptions },
                revenue: { total: totalRevenue, monthly: monthlyRevenue },
                topCreators,
            },
        });
    } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────────────────────
// KYC VERIFICATION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    List all verifications (filterable by status)
// @route   GET /api/admin/verifications?status=pending
// @access  Admin
const getVerifications = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const data = await paginate(CreatorVerification, filter, {
            page: req.query.page,
            limit: req.query.limit,
            sort: req.query.sort || '-submittedAt',
            populate: [
                { path: 'userId', select: 'name email' },
                { path: 'approvedBy', select: 'name email' },
            ],
        });

        res.status(200).json({
            success: true,
            ...data,
            results: data.results.map(maskVerificationData),
        });
    } catch (error) { next(error); }
};

// @desc    Approve a verification
// @route   PATCH /api/admin/verification/:id/approve
// @access  Admin
const approveVerification = async (req, res, next) => {
    try {
        const User = require('../models/User');
        const CreatorProfile = require('../models/CreatorProfile');

        const record = await CreatorVerification.findById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
        if (record.status === 'approved') return res.status(400).json({ success: false, message: 'Already approved' });

        record.status = 'approved';
        record.approvedBy = req.user._id;
        record.approvedAt = new Date();
        record.rejectionReason = null;
        await record.save({ validateBeforeSave: false });

        // ── Promote the user to creator role ──────────────────────────────────
        await User.findByIdAndUpdate(record.userId, {
            role: 'creator',
            creatorApplicationStatus: 'approved',
            creatorRejectionReason: '',
        });

        // Sync CreatorProfile verificationStatus if one exists
        await CreatorProfile.findOneAndUpdate(
            { userId: record.userId },
            { verificationStatus: 'approved' }
        );

        res.status(200).json({ success: true, message: 'Verification approved', data: maskVerificationData(record) });
    } catch (error) { next(error); }
};

// @desc    Reject a verification
// @route   PATCH /api/admin/verification/:id/reject
// @access  Admin
const rejectVerification = async (req, res, next) => {
    try {
        const User = require('../models/User');
        const CreatorProfile = require('../models/CreatorProfile');
        const { rejectionReason } = req.body;
        if (!rejectionReason) return res.status(400).json({ success: false, message: 'rejectionReason is required' });

        const record = await CreatorVerification.findById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

        record.status = 'rejected';
        record.rejectionReason = rejectionReason;
        record.approvedBy = null;
        record.approvedAt = null;
        await record.save({ validateBeforeSave: false });

        // ── Update user application status ────────────────────────────────────
        await User.findByIdAndUpdate(record.userId, {
            creatorApplicationStatus: 'rejected',
            creatorRejectionReason: rejectionReason,
        });

        // Sync CreatorProfile verificationStatus if one exists
        await CreatorProfile.findOneAndUpdate(
            { userId: record.userId },
            { verificationStatus: 'rejected' }
        );

        res.status(200).json({ success: true, message: 'Verification rejected', data: maskVerificationData(record) });
    } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc    List all payout requests (filterable by status)
// @route   GET /api/admin/payouts
// @access  Admin
const listAllPayouts = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;

        const data = await paginate(PayoutRequest, filter, {
            page: req.query.page,
            limit: req.query.limit,
            sort: req.query.sort || '-requestedAt',
            populate: [
                { path: 'creatorId', select: 'name email' },
                { path: 'processedBy', select: 'name email' },
            ],
        });

        // Attach bank details from CreatorVerification for each payout
        if (data.results && data.results.length > 0) {
            const creatorIds = data.results
                .map((p) => p.creatorId?._id)
                .filter(Boolean);

            const verifications = await CreatorVerification
                .find({ userId: { $in: creatorIds } })
                .select('userId bankAccountNumber ifscCode bankProofImageUrl accountHolderName bankName');
            // Note: no .lean() so Mongoose getters (AES decryption) auto-run on bankAccountNumber

            const verMap = {};
            verifications.forEach((v) => { verMap[v.userId.toString()] = v; });

            data.results = data.results.map((p) => {
                const pObj = p.toObject ? p.toObject() : { ...p };
                const cid = pObj.creatorId?._id?.toString();
                if (cid && verMap[cid]) {
                    const v = verMap[cid];
                    pObj.bankDetails = {
                        accountHolderName: v.accountHolderName || pObj.creatorId?.name || '',
                        bankName: v.bankName || '',
                        accountNumber: v.bankAccountNumber || '',
                        last4: v.bankAccountNumber ? v.bankAccountNumber.slice(-4) : '',
                        ifscCode: v.ifscCode || '',
                        bankProofImageUrl: v.bankProofImageUrl || '',
                    };
                } else {
                    pObj.bankDetails = null;
                }
                return pObj;
            });
        }


        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve a pending payout request
// @route   PATCH /api/admin/payouts/:id/approve
// @access  Admin
const approvePayout = async (req, res, next) => {
    try {
        const payout = await approvePayoutService(req.params.id, req.user._id);
        res.status(200).json({
            success: true,
            message: 'Payout approved successfully.',
            data: payout,
        });
    } catch (error) {
        next(error); // statusCode already set on operational errors from earningsService
    }
};

// @desc    Reject a pending payout request (restores creator pendingAmount)
// @route   PATCH /api/admin/payouts/:id/reject
// @access  Admin
const rejectPayout = async (req, res, next) => {
    try {
        const { notes } = req.body;
        const payout = await rejectPayoutService(req.params.id, req.user._id, notes);
        res.status(200).json({
            success: true,
            message: 'Payout rejected and creator balance restored.',
            data: payout,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark an approved payout as paid (funds transferred)
// @route   PATCH /api/admin/payouts/:id/mark-paid
// @access  Admin
const markPaid = async (req, res, next) => {
    try {
        const payout = await markPayoutPaidService(req.params.id, req.user._id);
        res.status(200).json({
            success: true,
            message: 'Payout marked as paid. Creator withdrawn amount updated.',
            data: payout,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR MANAGEMENT (Payout Admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get all creators with earnings summary (paginated, searchable, filterable)
 * @route   GET /api/admin/creators
 * @access  Admin
 */
const getCreators = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search = '', status, sort = '-createdAt' } = req.query;

        // Build user filter
        const userFilter = { role: 'creator' };
        if (status === 'suspended') userFilter.isBanned = true;
        if (status === 'active') userFilter.isBanned = false;

        // Search by name or email
        let userIds = null;
        if (search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            const matchedUsers = await User.find(
                { role: 'creator', $or: [{ name: regex }, { email: regex }] },
                '_id'
            ).lean();
            userIds = matchedUsers.map((u) => u._id);
            if (userIds.length === 0) {
                return res.status(200).json({ success: true, results: [], totalResults: 0, totalPages: 0, page: 1 });
            }
            userFilter._id = { $in: userIds };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [creators, totalResults] = await Promise.all([
            User.find(userFilter, '-password')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(userFilter),
        ]);

        if (creators.length === 0) {
            return res.status(200).json({ success: true, results: [], totalResults: 0, totalPages: 0, page: 1 });
        }

        const cids = creators.map((c) => c._id);

        // Fetch related data in parallel
        const [profiles, earningsDocs] = await Promise.all([
            CreatorProfile.find({ userId: { $in: cids } })
                .select('userId totalSubscribers genre verificationStatus profileImage displayName username')
                .lean(),
            Earnings.find({ creatorId: { $in: cids } }).lean(),
        ]);

        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        const earningsMap = {};
        earningsDocs.forEach((e) => { earningsMap[e.creatorId.toString()] = e; });

        const results = creators.map((creator) => {
            const cid = creator._id.toString();
            const profile = profileMap[cid] ?? {};
            const earning = earningsMap[cid] ?? { totalEarned: 0, pendingAmount: 0, withdrawnAmount: 0 };

            return {
                _id: creator._id,
                name: creator.name,
                email: creator.email,
                isBanned: creator.isBanned,
                createdAt: creator.createdAt,
                displayName: profile.displayName || creator.name,
                username: profile.username || '',
                profileImage: profile.profileImage || '',
                genre: profile.genre || '',
                totalSubscribers: profile.totalSubscribers ?? 0,
                verificationStatus: profile.verificationStatus || 'pending',
                totalEarned: earning.totalEarned ?? 0,
                pendingAmount: earning.pendingAmount ?? 0,
                withdrawnAmount: earning.withdrawnAmount ?? 0,
            };
        });

        res.status(200).json({
            success: true,
            results,
            totalResults,
            totalPages: Math.ceil(totalResults / parseInt(limit)),
            page: parseInt(page),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get full detail for a single creator (profile + bank + earnings)
 * @route   GET /api/admin/creators/:id
 * @access  Admin
 */
const getCreatorDetail = async (req, res, next) => {
    try {
        const creatorId = req.params.id;

        // ── Compute current week window: Sunday 00:00:00 → Saturday 23:59:59 ──
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const mongoose = require('mongoose');
        const objectCreatorId = new mongoose.Types.ObjectId(String(creatorId));

        const [creator, profile, verification, earnings, recentPayouts, weeklyAgg, overviewAgg] = await Promise.all([
            User.findById(creatorId, '-password').lean(),
            CreatorProfile.findOne({ userId: creatorId }).lean(),
            CreatorVerification.findOne({ userId: creatorId })
                .select('userId accountHolderName bankName bankAccountNumber ifscCode bankProofImageUrl status'),
            Earnings.findOne({ creatorId }).lean(),
            PayoutRequest.find({ creatorId })
                .sort({ requestedAt: -1 })
                .limit(20)
                .lean(),
            // Weekly earnings
            Payment.aggregate([
                {
                    $match: {
                        creatorId: objectCreatorId,
                        status: 'captured',
                        type: { $in: ['subscription', 'gift', 'chat_unlock'] },
                        createdAt: { $gte: weekStart, $lte: weekEnd },
                    },
                },
                { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
            ]),
            // Overview: total payments count, paid payouts count, active subscribers
            Promise.all([
                Payment.countDocuments({ creatorId: objectCreatorId, status: 'captured' }),
                PayoutRequest.countDocuments({ creatorId, status: 'paid' }),
                Subscription.countDocuments({ creatorId, status: 'active' }),
            ]),
        ]);

        if (!creator) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        // Safely build bank details (run Mongoose getter for AES decryption)
        let bankDetails = null;
        if (verification) {
            const acctNum = verification.bankAccountNumber || '';
            bankDetails = {
                accountHolderName: verification.accountHolderName || creator.name || '',
                bankName: verification.bankName || '',
                accountNumber: acctNum,
                last4: acctNum ? acctNum.slice(-4) : '',
                ifscCode: verification.ifscCode || '',
                bankProofImageUrl: verification.bankProofImageUrl || '',
                verificationStatus: verification.status || 'pending',
            };
        }

        const weeklyEarnings = Math.round((weeklyAgg[0]?.total ?? 0) * 100) / 100;
        const [totalPayments, totalPaidPayouts, activeSubscribers] = overviewAgg;

        res.status(200).json({
            success: true,
            data: {
                user: creator,
                profile: profile ?? {},
                bankDetails,
                financials: {
                    totalEarned: earnings?.totalEarned ?? 0,
                    pendingAmount: earnings?.pendingAmount ?? 0,
                    withdrawnAmount: earnings?.withdrawnAmount ?? 0,
                    weeklyEarnings,
                    weekStart: weekStart.toISOString(),
                    weekEnd: weekEnd.toISOString(),
                },
                overview: {
                    totalSubscribers: profile?.totalSubscribers ?? activeSubscribers ?? 0,
                    totalPosts: profile?.totalPosts ?? 0,
                    totalPayments,
                    totalPaidPayouts,
                    activeSubscribers,
                    joinedAt: creator.createdAt,
                },
                recentPayouts,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get a creator's posts/media for admin view (paginated)
 * @route   GET /api/admin/creators/:id/media?page=1&limit=20
 * @access  Admin
 */
const getCreatorMedia = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page  = Math.max(1, parseInt(req.query.page  ?? 1));
        const limit = Math.min(50, parseInt(req.query.limit ?? 20));
        const skip  = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            Post.find({ creatorId: id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments({ creatorId: id }),
        ]);

        res.json({
            success: true,
            data: {
                posts,
                total,
                page,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Admin deletes a creator's post (also removes from Cloudinary)
 * @route   DELETE /api/admin/creators/:id/media/:postId
 * @access  Admin
 */
const adminDeleteCreatorPost = async (req, res, next) => {
    try {
        const { id, postId } = req.params;
        const post = await Post.findOne({ _id: postId, creatorId: id });
        if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

        // Delete media from Cloudinary
        if (post.mediaPublicIds?.length) {
            await Promise.allSettled(
                post.mediaPublicIds
                    .filter(Boolean)
                    .map(pid => cloudinary.uploader.destroy(pid, {
                        resource_type: post.mediaType === 'video' ? 'video' : 'image',
                    }))
            );
        }

        await Post.findByIdAndDelete(postId);

        // Decrement totalPosts on CreatorProfile
        await CreatorProfile.findOneAndUpdate(
            { userId: id },
            { $inc: { totalPosts: -1 } }
        );

        res.json({ success: true, message: 'Post deleted successfully.' });
    } catch (error) { next(error); }
};



/**
 * @desc    Admin initiates a direct payout for a creator's full pending balance
 * @route   POST /api/admin/creators/:id/payout
 * @access  Admin
 */
const adminDirectPayout = async (req, res, next) => {
    try {
        const payout = await adminDirectPayoutService(req.params.id, req.user._id);
        res.status(200).json({
            success: true,
            message: `₹${payout.amount.toLocaleString('en-IN')} paid out successfully.`,
            data: payout,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME DATA REPAIR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Recalculate totalPosts + totalSubscribers for ALL creator profiles
 *          from actual Post and Subscription documents (idempotent).
 * @route   POST /api/admin/repair-stats
 * @access  Admin
 */
const repairStats = async (req, res, next) => {
    try {
        console.log('[repairStats] Starting stat repair...');

        // Aggregate actual post counts per creator
        const postCounts = await Post.aggregate([
            { $group: { _id: '$creatorId', count: { $sum: 1 } } },
        ]);

        // Aggregate active subscriber counts per creator
        const subCounts = await Subscription.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$creatorId', count: { $sum: 1 } } },
        ]);

        const postMap = {};
        postCounts.forEach((p) => { postMap[p._id.toString()] = p.count; });

        const subMap = {};
        subCounts.forEach((s) => { subMap[s._id.toString()] = s.count; });

        // Get all creator profiles
        const profiles = await CreatorProfile.find({}).select('_id userId');

        let updated = 0;
        const bulkOps = profiles.map((profile) => {
            const cid = profile.userId.toString();
            return {
                updateOne: {
                    filter: { _id: profile._id },
                    update: {
                        $set: {
                            totalPosts: postMap[cid] ?? 0,
                            totalSubscribers: subMap[cid] ?? 0,
                        },
                    },
                },
            };
        });

        if (bulkOps.length > 0) {
            const result = await CreatorProfile.bulkWrite(bulkOps);
            updated = result.modifiedCount;
        }

        console.log(`[repairStats] Done. Profiles checked: ${profiles.length}, updated: ${updated}`);

        res.status(200).json({
            success: true,
            message: `Stat repair complete. ${profiles.length} profiles checked, ${updated} updated.`,
            data: { profilesChecked: profiles.length, profilesUpdated: updated },
        });
    } catch (error) {
        console.error('[repairStats] Error:', error.message);
        next(error);
    }
};

/**
 * @desc    Remove duplicate Subscription documents (same userId+creatorId).
 *          Keeps the most recently created document and deletes all older ones.
 *          Run ONCE after deploying the unique index to clean existing bad data.
 * @route   POST /api/admin/dedup-subscriptions
 * @access  Admin
 */
const dedupSubscriptions = async (req, res, next) => {
    try {
        console.log('[dedupSubscriptions] Starting dedup...');

        // Find all (userId, creatorId) groups that have more than 1 document
        const groups = await Subscription.aggregate([
            {
                $group: {
                    _id: { userId: '$userId', creatorId: '$creatorId' },
                    count: { $sum: 1 },
                    ids: { $push: '$_id' },
                    // Keep the most recently created one
                    latestId: { $last: '$_id' },
                },
            },
            { $match: { count: { $gt: 1 } } },      // only groups with dups
        ]);

        let deleted = 0;
        for (const group of groups) {
            // Delete all IDs EXCEPT the most recent one
            const toDelete = group.ids.filter(
                (id) => id.toString() !== group.latestId.toString()
            );
            if (toDelete.length > 0) {
                const result = await Subscription.deleteMany({ _id: { $in: toDelete } });
                deleted += result.deletedCount;
            }
        }

        console.log(`[dedupSubscriptions] Done. Groups with dups: ${groups.length}, docs deleted: ${deleted}`);

        res.status(200).json({
            success: true,
            message: `Dedup complete. ${groups.length} duplicate groups found, ${deleted} stale documents removed.`,
            data: { duplicateGroups: groups.length, deleted },
        });
    } catch (error) {
        console.error('[dedupSubscriptions] Error:', error.message);
        next(error);
    }
};


/**
 * @desc    Admin updates a creator's profile fields
 * @route   PATCH /api/admin/creators/:id/profile
 * @access  Admin
 */
const adminUpdateCreatorProfile = async (req, res, next) => {
    try {
        const { displayName, bio, subscriptionPrice, genre } = req.body;
        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName.trim();
        if (bio !== undefined) updates.bio = bio.trim();
        if (genre !== undefined) updates.genre = genre.trim().toLowerCase();
        if (subscriptionPrice !== undefined && !isNaN(Number(subscriptionPrice))) {
            updates.subscriptionPrice = Math.max(1, Number(subscriptionPrice));
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update.' });
        }
        const profile = await CreatorProfile.findOneAndUpdate(
            { userId: req.params.id },
            { $set: updates },
            { returnDocument: 'after' }
        );
        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found.' });
        res.json({ success: true, message: 'Profile updated.', data: profile });
    } catch (error) { next(error); }
};

/**
 * @desc    Admin ban or unban a creator
 * @route   PUT /api/admin/creators/:id/ban  |  PUT /api/admin/creators/:id/unban
 * @access  Admin
 */
const adminToggleBan = async (req, res, next) => {
    try {
        const shouldBan = req.path.endsWith('/ban');
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Creator not found.' });
        if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot ban an admin account.' });
        user.isBanned = shouldBan;
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: `Creator ${shouldBan ? 'banned' : 'unbanned'} successfully.`, isBanned: shouldBan });
    } catch (error) { next(error); }
};

/**
 * @desc    Admin manually adjusts a creator's financial balances
 * @route   PATCH /api/admin/creators/:id/financials
 * @access  Admin
 */
const adminUpdateCreatorFinancials = async (req, res, next) => {
    try {
        const Earnings = require('../models/Earnings');
        const { totalEarned, pendingAmount, withdrawnAmount } = req.body;
        const updates = {};
        if (totalEarned    !== undefined && !isNaN(Number(totalEarned)))    updates.totalEarned    = Math.max(0, Number(totalEarned));
        if (pendingAmount  !== undefined && !isNaN(Number(pendingAmount)))  updates.pendingAmount  = Math.max(0, Number(pendingAmount));
        if (withdrawnAmount !== undefined && !isNaN(Number(withdrawnAmount))) updates.withdrawnAmount = Math.max(0, Number(withdrawnAmount));
        if (Object.keys(updates).length === 0)
            return res.status(400).json({ success: false, message: 'No financial fields to update.' });
        const earnings = await Earnings.findOneAndUpdate(
            { creatorId: req.params.id },
            { $set: updates },
            { returnDocument: 'after', upsert: false }
        );
        if (!earnings) return res.status(404).json({ success: false, message: 'Earnings record not found.' });
        res.json({ success: true, message: 'Financials updated.', data: earnings });
    } catch (error) { next(error); }
};

// One-time repair: backfill creatorEarning=0 gift Payment docs
// POST /api/v1/admin/repair-gift-earnings
const repairGiftEarnings = async (req, res, next) => {
    try {
        const Payment  = require('../models/Payment');
        const Earnings = require('../models/Earnings');

        // Find all gift payments with missing or zero creatorEarning
        const broken = await Payment.find({
            type: 'gift',
            status: 'captured',
            $or: [{ creatorEarning: { $lte: 0 } }, { creatorEarning: { $exists: false } }],
        });

        let fixed = 0;
        for (const p of broken) {
            const gross = Number(p.giftAmount || p.amount || 0);
            if (!gross) continue;

            const base          = Math.round(gross / 1.18 * 100) / 100;
            const creatorEarning = Math.round(base * 0.8 * 100) / 100;
            const platformFee   = Math.round(base * 0.2 * 100) / 100;
            const gstAmount     = Math.round((gross - base) * 100) / 100;

            // Patch the Payment doc
            await Payment.findByIdAndUpdate(p._id, {
                $set: { baseAmount: base, gstAmount, platformFee, creatorEarning },
            });

            // Credit Earnings if not already credited
            if (!p._earningsCredited && p.creatorId) {
                await Earnings.findOneAndUpdate(
                    { creatorId: p.creatorId },
                    { $inc: { totalEarned: creatorEarning, pendingAmount: creatorEarning } },
                    { upsert: true }
                );
                await Payment.findByIdAndUpdate(p._id, { $set: { _earningsCredited: true } });
            }
            fixed++;
        }

        res.json({ success: true, message: `Repaired ${fixed} gift Payment docs`, total: broken.length, fixed });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getAllUsers,
    getUserById,
    banUser,
    unbanUser,
    deleteUser,
    getAllPosts,
    adminDeletePost,
    getAnalytics,
    getVerifications,
    approveVerification,
    rejectVerification,
    // Payout management
    listAllPayouts,
    approvePayout,
    rejectPayout,
    markPaid,
    // Creator Payout Management
    getCreators,
    getCreatorDetail,
    adminDirectPayout,
    adminUpdateCreatorProfile,
    adminUpdateCreatorFinancials,
    adminToggleBan,
    getCreatorMedia,
    adminDeleteCreatorPost,
    // One-time repairs
    repairStats,
    dedupSubscriptions,
    repairGiftEarnings,
};
