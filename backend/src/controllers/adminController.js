const User = require('../models/User');
const Post = require('../models/Post');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const CreatorProfile = require('../models/CreatorProfile');
const CreatorVerification = require('../models/CreatorVerification');
const PayoutRequest = require('../models/PayoutRequest');
const paginate = require('../utils/paginate');
const {
    approvePayoutService,
    markPayoutPaidService,
    rejectPayoutService,
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
};
