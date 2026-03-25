const mongoose = require('mongoose');
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPER: Full cascade account deletion
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Permanently delete a user (or creator) and ALL associated data from every
 * collection.  Also purges Cloudinary assets for posts and profile images.
 *
 * Deletion order (dependencies first):
 *  1. Creator's posts + Cloudinary media
 *  2. Creator-specific collections (Profile, Verification, Earnings, Payouts, DreamFunds)
 *  3. Shared collections (Subscriptions, Payments, ChatMessages, ChatRooms,
 *                         Notifications, Comments, Likes, ProfileViews,
 *                         SecurityLogs, IssueReports)
 *  4. User document
 *
 * @param {string|ObjectId} userId      - ID of the user to delete
 * @param {boolean}         isAdmin     - whether the target user is an admin (blocked)
 * @returns {Promise<{deleted: Object}>} - summary of deleted counts
 */
const _cascadeDeleteAccount = async (userId) => {
    // Lazy-require models not imported at the top of the file
    const ChatMessage  = require('../models/ChatMessage');
    const ChatRoom     = require('../models/ChatRoom');
    const Notification = require('../models/Notification');
    const PostComment  = require('../models/PostComment');
    const PostLike     = require('../models/PostLike');
    const ProfileView  = require('../models/ProfileView');
    const SecurityLog  = require('../models/SecurityLog');
    const IssueReport  = require('../models/IssueReport');
    const DreamFund         = require('../models/DreamFund');
    const DreamFundContribution = require('../models/DreamFundContribution');

    const deletedSummary = {};
    const uid = String(userId);

    // ── 1. Delete creator's posts + Cloudinary media ──────────────────────────
    const posts = await Post.find({ creatorId: uid });
    let mediaDeleted = 0;
    for (const post of posts) {
        // Delete all Cloudinary assets attached to this post
        const urls = post.mediaUrls ?? (post.mediaUrl ? [post.mediaUrl] : []);
        const publicIds = post.mediaPublicIds ?? (post.mediaPublicId ? [post.mediaPublicId] : []);
        for (let i = 0; i < publicIds.length; i++) {
            try {
                const resourceType = (post.mediaType === 'video' || (urls[i] && urls[i].includes('/video/'))) ? 'video' : 'image';
                await cloudinary.uploader.destroy(publicIds[i], { resource_type: resourceType });
                mediaDeleted++;
            } catch { /* non-fatal — continue if Cloudinary asset already gone */ }
        }
    }
    const { deletedCount: postsDeleted } = await Post.deleteMany({ creatorId: uid });
    deletedSummary.posts = postsDeleted;
    deletedSummary.cloudinaryAssets = mediaDeleted;

    // ── 2. Delete post interactions authored by this user ─────────────────────
    const [{ deletedCount: commentsDeleted }, { deletedCount: likesDeleted }] = await Promise.all([
        PostComment.deleteMany({ $or: [{ userId: uid }, { creatorId: uid }] }),
        PostLike.deleteMany({ userId: uid }),
    ]);
    deletedSummary.comments = commentsDeleted;
    deletedSummary.likes    = likesDeleted;

    // ── 3. Delete profile image from Cloudinary ────────────────────────────────
    const profile = await CreatorProfile.findOne({ userId: uid });
    if (profile?.profileImagePublicId) {
        try { await cloudinary.uploader.destroy(profile.profileImagePublicId); } catch { /* ignore */ }
    }

    // ── 4. Creator-specific collections ───────────────────────────────────────
    const [
        { deletedCount: profileDeleted },
        { deletedCount: verificationDeleted },
        { deletedCount: earningsDeleted },
        { deletedCount: payoutsDeleted },
    ] = await Promise.all([
        CreatorProfile.deleteMany({ userId: uid }),
        CreatorVerification.deleteMany({ userId: uid }),
        Earnings.deleteMany({ creatorId: uid }),
        PayoutRequest.deleteMany({ creatorId: uid }),
    ]);
    deletedSummary.creatorProfile     = profileDeleted;
    deletedSummary.creatorVerification = verificationDeleted;
    deletedSummary.earnings           = earningsDeleted;
    deletedSummary.payoutRequests     = payoutsDeleted;

    // ── 5. Dream Fund — goals created by the creator, contributions by this user
    const dreamFundIds = (await DreamFund.find({ creatorId: uid }).select('_id')).map(d => d._id);
    const [
        { deletedCount: dreamFundsDeleted },
        { deletedCount: contributionsAsCreator },
        { deletedCount: contributionsAsFan },
    ] = await Promise.all([
        DreamFund.deleteMany({ creatorId: uid }),
        DreamFundContribution.deleteMany({ dreamFundId: { $in: dreamFundIds } }),
        DreamFundContribution.deleteMany({ userId: uid }),
    ]);
    deletedSummary.dreamFunds    = dreamFundsDeleted;
    deletedSummary.contributions = contributionsAsCreator + contributionsAsFan;

    // ── 6. Subscriptions (as creator OR as fan) ────────────────────────────────
    const { deletedCount: subsDeleted } = await Subscription.deleteMany({
        $or: [{ creatorId: uid }, { userId: uid }],
    });
    deletedSummary.subscriptions = subsDeleted;

    // ── 7. Payments (as creator OR as paying fan) ─────────────────────────────
    const { deletedCount: paymentsDeleted } = await Payment.deleteMany({
        $or: [{ creatorId: uid }, { userId: uid }],
    });
    deletedSummary.payments = paymentsDeleted;

    // ── 8. Chat rooms + messages ───────────────────────────────────────────────
    const chatRooms = await ChatRoom.find({
        $or: [{ creatorId: uid }, { userId: uid }],
    }).select('_id');
    const roomIds = chatRooms.map(r => r._id);
    const [{ deletedCount: messagesDeleted }, { deletedCount: roomsDeleted }] = await Promise.all([
        ChatMessage.deleteMany({ roomId: { $in: roomIds } }),
        ChatRoom.deleteMany({ _id: { $in: roomIds } }),
    ]);
    deletedSummary.chatMessages = messagesDeleted;
    deletedSummary.chatRooms    = roomsDeleted;

    // ── 9. Notifications ───────────────────────────────────────────────────────
    const { deletedCount: notificationsDeleted } = await Notification.deleteMany({
        $or: [{ userId: uid }, { senderId: uid }],
    });
    deletedSummary.notifications = notificationsDeleted;

    // ── 10. Profile views ──────────────────────────────────────────────────────
    const { deletedCount: profileViewsDeleted } = await ProfileView.deleteMany({
        $or: [{ viewerId: uid }, { creatorId: uid }],
    });
    deletedSummary.profileViews = profileViewsDeleted;

    // ── 11. Security logs ──────────────────────────────────────────────────────
    const { deletedCount: securityLogsDeleted } = await SecurityLog.deleteMany({ userId: uid });
    deletedSummary.securityLogs = securityLogsDeleted;

    // ── 12. Issue reports ──────────────────────────────────────────────────────
    const { deletedCount: issueReportsDeleted } = await IssueReport.deleteMany({
        $or: [{ reportedBy: uid }, { userId: uid }],
    });
    deletedSummary.issueReports = issueReportsDeleted;

    return deletedSummary;
};

// @desc    Delete a user/creator account permanently (full cascade)
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'admin') {
            return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
        }

        const deletedSummary = await _cascadeDeleteAccount(req.params.id);

        // Finally delete the User document
        await user.deleteOne();

        console.log(`[adminDeleteUser] Deleted account ${user.email}:`, deletedSummary);
        res.status(200).json({
            success: true,
            message: `Account for ${user.email} and all associated data has been permanently deleted.`,
            data: { deleted: deletedSummary },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a creator's account + ALL data from every collection + Cloudinary
// @route   DELETE /api/admin/creators/:id
// @access  Admin
const deleteCreator = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Creator not found' });
        if (user.role === 'admin') {
            return res.status(400).json({ success: false, message: 'Cannot delete an admin account' });
        }

        const deletedSummary = await _cascadeDeleteAccount(req.params.id);

        // Finally delete the User document
        await user.deleteOne();

        console.log(`[adminDeleteCreator] Deleted creator ${user.email}:`, deletedSummary);
        res.status(200).json({
            success: true,
            message: `Creator ${user.email} and all their data has been permanently deleted.`,
            data: { deleted: deletedSummary },
        });
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

        // BUG-06 Fix: decrement totalPosts on CreatorProfile to keep counter in sync
        await CreatorProfile.findOneAndUpdate(
            { userId: post.creatorId },
            { $inc: { totalPosts: -1 } }
        );

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
        const cidStrings = cids.map((id) => id.toString());

        // FIX-6: Use live Payment aggregation for earnings — same source of truth as creator dashboard
        const { EARNING_TYPES } = require('../services/earningsService');

        const [profiles, earningsAgg, withdrawnDocs, inFlightAgg] = await Promise.all([
            CreatorProfile.find({ userId: { $in: cids } })
                .select('userId totalSubscribers genre verificationStatus profileImage displayName username')
                .lean(),
            // Live totalEarned from Payment collection
            Payment.aggregate([
                {
                    $match: {
                        creatorId: { $in: cids },
                        status: 'captured',
                        type: { $in: EARNING_TYPES },
                    },
                },
                { $group: { _id: '$creatorId', totalEarned: { $sum: '$creatorEarning' } } },
            ]),
            // withdrawnAmount from Earnings doc (only source of truth for this field)
            Earnings.find({ creatorId: { $in: cids } }).select('creatorId withdrawnAmount').lean(),
            // In-flight payouts
            PayoutRequest.aggregate([
                {
                    $match: {
                        creatorId: { $in: cids },
                        status: { $in: ['pending', 'approved'] },
                    },
                },
                { $group: { _id: '$creatorId', inFlight: { $sum: '$amount' } } },
            ]),
        ]);

        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        // Build earnings lookup maps (keyed by creatorId string)
        const R = (n) => Math.round(n * 100) / 100;
        const earnedMap = {};
        earningsAgg.forEach((e) => { earnedMap[e._id.toString()] = R(e.totalEarned ?? 0); });

        const withdrawnMap = {};
        withdrawnDocs.forEach((e) => { withdrawnMap[e.creatorId.toString()] = R(e.withdrawnAmount ?? 0); });

        const inFlightMap = {};
        inFlightAgg.forEach((e) => { inFlightMap[e._id.toString()] = R(e.inFlight ?? 0); });

        const results = creators.map((creator) => {
            const cid = creator._id.toString();
            const profile = profileMap[cid] ?? {};
            const totalEarned     = earnedMap[cid]    ?? 0;
            const withdrawnAmount = withdrawnMap[cid]  ?? 0;
            const inFlight        = inFlightMap[cid]   ?? 0;
            const pendingAmount   = R(Math.max(0, totalEarned - withdrawnAmount - inFlight));

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
                totalEarned,
                pendingAmount,
                withdrawnAmount,
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

        const objectCreatorId = new mongoose.Types.ObjectId(String(creatorId));
        const { EARNING_TYPES } = require('../services/earningsService');

        // BUG-13 Fix: support pagination for payout history
        const payoutPage  = Math.max(1, parseInt(req.query.payoutPage  ?? 1));
        const payoutLimit = Math.min(100, parseInt(req.query.payoutLimit ?? 20));
        const payoutSkip  = (payoutPage - 1) * payoutLimit;

        const [creator, profile, verification, payoutsResult, earningsAgg, withdrawnDoc, inFlightAgg, weeklyAgg, overviewAgg] = await Promise.all([
            User.findById(creatorId, '-password').lean(),
            CreatorProfile.findOne({ userId: creatorId }).lean(),
            CreatorVerification.findOne({ userId: creatorId })
                .select('userId accountHolderName bankName bankAccountNumber ifscCode bankProofImageUrl status'),
            // BUG-13 Fix: paginated payout history
            Promise.all([
                PayoutRequest.find({ creatorId })
                    .sort({ requestedAt: -1 })
                    .skip(payoutSkip)
                    .limit(payoutLimit)
                    .lean(),
                PayoutRequest.countDocuments({ creatorId }),
            ]),
            // FIX-7: Live totalEarned from Payment collection (source of truth)
            Payment.aggregate([
                {
                    $match: {
                        creatorId: objectCreatorId,
                        status: 'captured',
                        type: { $in: EARNING_TYPES },
                    },
                },
                { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
            ]),
            // FIX-7: withdrawnAmount from Earnings doc (only source of truth for this field)
            Earnings.findOne({ creatorId }).lean(),
            // FIX-7: In-flight payouts (live)
            PayoutRequest.aggregate([
                {
                    $match: {
                        creatorId: objectCreatorId,
                        status: { $in: ['pending', 'approved'] },
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            // Weekly earnings from Payment collection
            Payment.aggregate([
                {
                    $match: {
                        creatorId: objectCreatorId,
                        status: 'captured',
                        type: { $in: EARNING_TYPES },
                        createdAt: { $gte: weekStart, $lte: weekEnd },
                    },
                },
                { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
            ]),
            // BUG-04/BUG-05 Fix: fetch live counts in parallel
            Promise.all([
                Payment.countDocuments({ creatorId: objectCreatorId, status: 'captured' }),
                PayoutRequest.countDocuments({ creatorId, status: 'paid' }),
                Subscription.countDocuments({ creatorId, status: 'active' }),
                Post.countDocuments({ creatorId }),
            ]),
        ]);

        if (!creator) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        const [recentPayouts, payoutTotal] = payoutsResult;

        // Safely build bank details
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

        // FIX-7: Compute financials from live Payment aggregation — NOT stale Earnings doc
        const R = (n) => Math.round(n * 100) / 100;
        const totalEarned     = R(earningsAgg[0]?.total    ?? 0);
        const withdrawnAmount = R(withdrawnDoc?.withdrawnAmount ?? 0);
        const inFlight        = R(inFlightAgg[0]?.total    ?? 0);
        const pendingAmount   = R(Math.max(0, totalEarned - withdrawnAmount - inFlight));
        const weeklyEarnings  = R(weeklyAgg[0]?.total      ?? 0);

        const [totalPayments, totalPaidPayouts, activeSubscribers, liveTotalPosts] = overviewAgg;

        res.status(200).json({
            success: true,
            data: {
                user: creator,
                profile: profile ?? {},
                bankDetails,
                financials: {
                    totalEarned,
                    pendingAmount,
                    withdrawnAmount,
                    weeklyEarnings,
                    weekStart: weekStart.toISOString(),
                    weekEnd: weekEnd.toISOString(),
                },
                overview: {
                    totalSubscribers: activeSubscribers,
                    totalPosts: liveTotalPosts,
                    totalPayments,
                    totalPaidPayouts,
                    activeSubscribers,
                    joinedAt: creator.createdAt,
                },
                recentPayouts,
                payoutPagination: {
                    total: payoutTotal,
                    page: payoutPage,
                    limit: payoutLimit,
                    pages: Math.ceil(payoutTotal / payoutLimit),
                },
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
 * @desc    Admin adjusts a creator's withdrawnAmount (the only manually-editable field).
 *          totalEarned and pendingAmount are computed live from Payment collection.
 * @route   PATCH /api/admin/creators/:id/financials
 * @access  Admin
 */
const adminUpdateCreatorFinancials = async (req, res, next) => {
    try {
        // FIX-8: totalEarned and pendingAmount are live-computed — only withdrawnAmount is editable
        const { EARNING_TYPES, toObjectId } = require('../services/earningsService');
        const { withdrawnAmount } = req.body;

        if (withdrawnAmount === undefined || isNaN(Number(withdrawnAmount))) {
            return res.status(400).json({
                success: false,
                message: 'Only withdrawnAmount can be adjusted. totalEarned and pendingAmount are live-computed from Payment records.',
            });
        }

        const newWithdrawn = Math.max(0, Math.round(Number(withdrawnAmount) * 100) / 100);
        const R = (n) => Math.round(n * 100) / 100;
        const creatorObjId = toObjectId(req.params.id);

        // Compute live totalEarned to validate
        const [earningsAgg, inFlightAgg] = await Promise.all([
            Payment.aggregate([
                { $match: { creatorId: creatorObjId, status: 'captured', type: { $in: EARNING_TYPES } } },
                { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
            ]),
            PayoutRequest.aggregate([
                { $match: { creatorId: creatorObjId, status: { $in: ['pending', 'approved'] } } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        const totalEarned = R(earningsAgg[0]?.total ?? 0);
        const inFlight    = R(inFlightAgg[0]?.total  ?? 0);

        if (newWithdrawn > totalEarned) {
            return res.status(400).json({
                success: false,
                message: `withdrawnAmount (₹${newWithdrawn}) cannot exceed live totalEarned (₹${totalEarned}).`,
            });
        }

        const updated = await Earnings.findOneAndUpdate(
            { creatorId: req.params.id },
            { $set: { withdrawnAmount: newWithdrawn } },
            { returnDocument: 'after', upsert: false }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'No earnings record found for this creator.' });

        const pendingAmount = R(Math.max(0, totalEarned - newWithdrawn - inFlight));
        res.json({
            success: true,
            message: 'withdrawnAmount updated.',
            data: { withdrawnAmount: newWithdrawn, totalEarned, pendingAmount },
        });
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
    deleteCreator,
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
    deleteCreator,
    // One-time repairs
    repairStats,
    dedupSubscriptions,
    repairGiftEarnings,
};
