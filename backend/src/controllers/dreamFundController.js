/**
 * Dream Fund Controller
 * Handles creator goal management, fan contributions, and proof upload.
 */
const mongoose = require('mongoose');
const DreamFund = require('../models/DreamFund');
const DreamFundContribution = require('../models/DreamFundContribution');
const PaymentModel = require('../models/Payment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const CreatorProfile = require('../models/CreatorProfile');
const paymentService = require('../services/paymentService');
const { calcGST } = require('../utils/gstHelper');
const { safeCfStatus } = paymentService;
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Multer config for dream fund image/proof uploads ─────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/dream-fund');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `df_${req.user._id}_${Date.now()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image/video files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helper: send a notification ───────────────────────────────────────────────
async function sendNotification({ recipientId, type, title, body, referenceId }) {
    try {
        await Notification.create({
            recipientId,
            type,
            title,
            body: body || '',
            referenceId,
            referenceModel: 'DreamFund',
        });
    } catch (e) {
        console.warn('[dreamFund] notification failed:', e.message);
    }
}

// ── Helper: get absolute URL for serving uploads ──────────────────────────────
// Returns a full URL so images load from the API server, not the frontend domain.
function getUploadUrl(filePath) {
    if (!filePath) return null;
    const filename = path.basename(filePath);
    // Use API_URL env var (e.g. https://api.fannex.in) or fall back to CLIENT_URL API subdomain
    const apiBase = process.env.API_URL
        || (process.env.CLIENT_URL || '').split(',')[0].trim().replace('https://fannex.in', 'https://api.fannex.in').replace('https://www.fannex.in', 'https://api.fannex.in')
        || '';
    return `${apiBase}/uploads/dream-fund/${filename}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR SIDE
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Creator creates a Dream Fund goal (max 3)
// @route POST /api/v1/dream-fund/goals
// @access Private (creator)
const createGoal = async (req, res, next) => {
    try {
        const { title, description, targetAmount } = req.body;
        const creatorId = req.user._id;

        if (!title || !targetAmount) {
            return res.status(400).json({ success: false, message: 'title and targetAmount are required' });
        }

        const amount = Number(targetAmount);
        if (isNaN(amount) || amount < 1) {
            return res.status(400).json({ success: false, message: 'targetAmount must be at least ₹1' });
        }

        // Enforce max 3 active goals (pending + approved + completed)
        const activeCount = await DreamFund.countDocuments({
            creatorId,
            status: { $in: ['pending', 'approved', 'completed', 'awaiting_verification'] },
        });
        if (activeCount >= 3) {
            return res.status(400).json({ success: false, message: 'You can have at most 3 active Dream Fund goals' });
        }

        // Handle optional image upload
        let imageUrl = null;
        if (req.file) {
            imageUrl = getUploadUrl(req.file.path);
        }

        const goal = await DreamFund.create({
            creatorId,
            title: title.trim(),
            description: (description || '').trim(),
            targetAmount: amount,
            image: imageUrl,
        });

        res.status(201).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// @desc  Creator views their own goals (all statuses)
// @route GET /api/v1/dream-fund/goals/me
// @access Private (creator)
const getMyGoals = async (req, res, next) => {
    try {
        const goals = await DreamFund.find({ creatorId: req.user._id })
            .sort({ createdAt: -1 })
            .lean();

        // Attach contributor count per goal
        const goalIds = goals.map(g => g._id);
        const contributorCounts = await DreamFundContribution.aggregate([
            { $match: { goalId: { $in: goalIds } } },
            { $group: { _id: '$goalId', count: { $sum: 1 } } },
        ]);
        const countMap = Object.fromEntries(contributorCounts.map(c => [c._id.toString(), c.count]));

        const data = goals.map(g => ({
            ...g,
            supporterCount: countMap[g._id.toString()] || 0,
        }));

        res.status(200).json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

// @desc  Creator updates their goal (only if pending or approved, before completion)
// @route PUT /api/v1/dream-fund/goals/:id
// @access Private (creator)
const updateGoal = async (req, res, next) => {
    try {
        const goal = await DreamFund.findOne({ _id: req.params.id, creatorId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
        if (['completed', 'awaiting_verification', 'verified'].includes(goal.status)) {
            return res.status(400).json({ success: false, message: 'Cannot edit a completed goal' });
        }

        const { title, description, targetAmount } = req.body;
        if (title) goal.title = title.trim();
        if (description !== undefined) goal.description = description.trim();
        if (targetAmount) {
            const amount = Number(targetAmount);
            if (isNaN(amount) || amount < 100) {
                return res.status(400).json({ success: false, message: 'targetAmount must be at least ₹100' });
            }
            goal.targetAmount = amount;
        }
        if (req.file) {
            goal.image = getUploadUrl(req.file.path);
        }

        await goal.save();
        res.status(200).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// @desc  Creator uploads proof after goal is completed
// @route POST /api/v1/dream-fund/goals/:id/proof
// @access Private (creator)
const uploadProof = async (req, res, next) => {
    try {
        const goal = await DreamFund.findOne({ _id: req.params.id, creatorId: req.user._id });
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
        if (goal.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Proof can only be uploaded for completed goals' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const proofType = ['.mp4', '.mov'].includes(ext) ? 'video' : 'image';

        goal.proof = { url: getUploadUrl(req.file.path), type: proofType };
        goal.status = 'awaiting_verification';
        await goal.save();

        res.status(200).json({ success: true, data: goal, message: 'Proof uploaded. Awaiting admin verification.' });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FAN SIDE (PUBLIC)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Public: get approved/completed goals for a creator (by userId)
// @route GET /api/v1/dream-fund/goals/:creatorId
// @access Public
const getCreatorGoals = async (req, res, next) => {
    try {
        const { creatorId } = req.params;
        const goals = await DreamFund.find({
            creatorId,
            status: { $in: ['approved', 'completed', 'awaiting_verification', 'verified'] },
        })
            .sort({ createdAt: -1 })
            .lean();

        // Attach supporter count via aggregation
        const goalIds = goals.map(g => g._id);
        const contributorAgg = await DreamFundContribution.aggregate([
            { $match: { goalId: { $in: goalIds } } },
            { $group: { _id: '$goalId', count: { $sum: 1 } } },
        ]);
        const countMap = Object.fromEntries(contributorAgg.map(c => [c._id.toString(), c.count]));

        const data = goals.map(g => ({
            ...g,
            supporterCount: countMap[g._id.toString()] || 0,
            progressPct: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
            remaining: Math.max(0, g.targetAmount - g.currentAmount),
        }));

        res.status(200).json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

// @desc  Get top 5 contributors for a goal
// @route GET /api/v1/dream-fund/goals/:id/contributors
// @access Public
const getTopContributors = async (req, res, next) => {
    try {
        const goalId = req.params.id;

        const contributors = await DreamFundContribution.aggregate([
            { $match: { goalId: new mongoose.Types.ObjectId(goalId) } },
            { $group: { _id: '$userId', totalAmount: { $sum: '$amount' }, isAnonymous: { $first: '$isAnonymous' } } },
            { $sort: { totalAmount: -1 } },
            { $limit: 5 },
        ]);

        // Populate user info for non-anonymous
        const populated = await Promise.all(contributors.map(async (c) => {
            if (c.isAnonymous) {
                return { name: 'Anonymous', profileImage: null, totalAmount: c.totalAmount, isAnonymous: true };
            }
            const user = await User.findById(c._id).select('name profileImage username').lean();
            return {
                name: user?.name || 'Fan',
                username: user?.username || null,
                profileImage: user?.profileImage || null,
                totalAmount: c.totalAmount,
                isAnonymous: false,
            };
        }));

        res.status(200).json({ success: true, data: populated });
    } catch (err) {
        next(err);
    }
};

// @desc  Get recent 10 contributions for live feed
// @route GET /api/v1/dream-fund/goals/:id/feed
// @access Public
const getRecentContributions = async (req, res, next) => {
    try {
        const goalId = req.params.id;

        const contributions = await DreamFundContribution.find({ goalId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'name username profileImage')
            .lean();

        const data = contributions.map(c => ({
            _id: c._id,
            amount: c.amount,
            message: c.message,
            isAnonymous: c.isAnonymous,
            createdAt: c.createdAt,
            user: c.isAnonymous ? null : {
                name: c.userId?.name || 'Fan',
                username: c.userId?.username || null,
                profileImage: c.userId?.profileImage || null,
            },
        }));

        res.status(200).json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTION PAYMENT FLOW
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Fan creates a Cashfree order to contribute to a Dream Fund goal
// @route POST /api/v1/dream-fund/contribute/order
// @access Private (user)
const createContributionOrder = async (req, res, next) => {
    try {
        const { goalId, amount, message, isAnonymous } = req.body;
        const user = req.user;

        if (!goalId || !amount) {
            return res.status(400).json({ success: false, message: 'goalId and amount are required' });
        }

        const parsed = Number(amount);
        if (isNaN(parsed) || parsed < 1) {
            return res.status(400).json({ success: false, message: 'Minimum contribution is ₹1' });
        }
        if (parsed > 100000) {
            return res.status(400).json({ success: false, message: 'Maximum contribution is ₹1,00,000' });
        }

        const goal = await DreamFund.findById(goalId);
        if (!goal) return res.status(404).json({ success: false, message: 'Dream Fund goal not found' });
        if (goal.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'This goal is not accepting contributions' });
        }

        // Apply 18% GST
        const gst = calcGST(parsed);
        const orderId = `df_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: gst.totalPaid,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/dream-fund-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                creatorId: goal.creatorId.toString(),
                goalId: goalId.toString(),
                type: 'dream_fund',
                baseAmount: gst.baseAmount.toString(),
                message: (message || '').slice(0, 300),
                isAnonymous: isAnonymous ? 'true' : 'false',
            },
        });

        res.status(200).json({
            success: true,
            data: {
                ...order,
                gstBreakdown: {
                    baseAmount: gst.baseAmount,
                    gstAmount: gst.gstAmount,
                    totalPaid: gst.totalPaid,
                },
            },
        });
    } catch (err) {
        const cfMessage = err?.response?.data?.message;
        const upstreamStatus = err?.response?.status;
        if (cfMessage) {
            return res.status(safeCfStatus(upstreamStatus) || 400).json({ success: false, message: cfMessage });
        }
        next(err);
    }
};

// @desc  Fan verifies Dream Fund contribution after Cashfree redirect
// @route POST /api/v1/dream-fund/contribute/verify
// @access Private (user)
const verifyContribution = async (req, res, next) => {
    try {
        const { orderId, goalId } = req.body;
        const userId = req.user._id;

        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        // Verify with Cashfree
        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: `Payment not completed. Status: ${orderData.order_status}` });
        }

        const tags = (orderData.order_tags && typeof orderData.order_tags === 'object') ? orderData.order_tags : {};
        const resolvedGoalId = goalId || tags.goalId;
        const resolvedCreatorId = tags.creatorId;
        const baseAmount = Number(tags.baseAmount || (orderData.order_amount / 1.18).toFixed(2));
        const contributionMessage = tags.message || '';
        const anonymous = tags.isAnonymous === 'true';

        if (!resolvedGoalId) {
            return res.status(400).json({ success: false, message: 'Could not determine goal from order' });
        }

        // Idempotency: check if already recorded
        const existing = await DreamFundContribution.findOne({ paymentId: orderId });
        if (existing) {
            return res.status(200).json({ success: true, message: 'Contribution already recorded', alreadyRecorded: true });
        }

        // Fetch cfPaymentId
        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch { /* optional */ }

        // Record contribution + update goal atomically
        const [, goal] = await Promise.all([
            DreamFundContribution.create({
                userId,
                creatorId: resolvedCreatorId,
                goalId: resolvedGoalId,
                amount: baseAmount,
                paymentId: orderId,
                message: contributionMessage,
                isAnonymous: anonymous,
            }),
            DreamFund.findByIdAndUpdate(
                resolvedGoalId,
                { $inc: { currentAmount: baseAmount } },
                { new: true }
            ),
        ]);

        // Record Payment doc
        try {
            await PaymentModel.create({
                userId,
                creatorId: resolvedCreatorId,
                goalId: resolvedGoalId,
                amount: orderData.order_amount,
                baseAmount,
                gstAmount: orderData.order_amount - baseAmount,
                currency: 'INR',
                type: 'dream_fund',
                status: 'captured',
                cfOrderId: orderId,
                cfPaymentId,
                sideEffectsDone: true,
            });
        } catch (dbErr) {
            console.warn('[dreamFund.verifyContribution] Payment doc create failed:', dbErr.message);
        }

        // Check if goal is now completed
        let completed = false;
        if (goal && goal.currentAmount >= goal.targetAmount && goal.status === 'approved') {
            await DreamFund.findByIdAndUpdate(resolvedGoalId, {
                status: 'completed',
                completedAt: new Date(),
            });
            completed = true;

            // Notify creator
            await sendNotification({
                recipientId: goal.creatorId,
                type: 'dream_fund_completed',
                title: '🎉 Dream Fund Goal Achieved!',
                body: `Your goal "${goal.title}" has been fully funded! Please upload proof.`,
                referenceId: goal._id,
            });
        }

        res.status(200).json({
            success: true,
            message: completed ? 'Goal completed! 🎉' : 'Contribution recorded successfully',
            completed,
            data: {
                currentAmount: goal?.currentAmount || 0,
                targetAmount: goal?.targetAmount || 0,
                progressPct: goal ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SIDE
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Admin: list all dream funds (filter by status)
// @route GET /api/v1/admin/dream-funds
const adminListDreamFunds = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};

        const goals = await DreamFund.find(filter)
            .sort({ createdAt: -1 })
            .populate('creatorId', 'name username email')
            .lean();

        res.status(200).json({ success: true, data: goals });
    } catch (err) {
        next(err);
    }
};

// @desc  Admin: approve a dream fund goal
// @route PATCH /api/v1/admin/dream-funds/:id/approve
const adminApproveGoal = async (req, res, next) => {
    try {
        const goal = await DreamFund.findByIdAndUpdate(
            req.params.id,
            { status: 'approved', actionedBy: req.user._id },
            { new: true }
        );
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

        await sendNotification({
            recipientId: goal.creatorId,
            type: 'dream_fund_approved',
            title: '✅ Dream Fund Approved!',
            body: `Your goal "${goal.title}" is now live on your profile.`,
            referenceId: goal._id,
        });

        res.status(200).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// @desc  Admin: reject a dream fund goal
// @route PATCH /api/v1/admin/dream-funds/:id/reject
const adminRejectGoal = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const goal = await DreamFund.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected', rejectionReason: reason || '', actionedBy: req.user._id },
            { new: true }
        );
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

        await sendNotification({
            recipientId: goal.creatorId,
            type: 'dream_fund_rejected',
            title: '❌ Dream Fund Rejected',
            body: reason ? `Your goal "${goal.title}" was rejected: ${reason}` : `Your goal "${goal.title}" was rejected.`,
            referenceId: goal._id,
        });

        res.status(200).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// @desc  Admin: verify proof after goal completion
// @route PATCH /api/v1/admin/dream-funds/:id/verify-proof
const adminVerifyProof = async (req, res, next) => {
    try {
        const goal = await DreamFund.findByIdAndUpdate(
            req.params.id,
            { status: 'verified', actionedBy: req.user._id },
            { new: true }
        );
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

        await sendNotification({
            recipientId: goal.creatorId,
            type: 'dream_fund_proof_approved',
            title: '✅ Proof Verified!',
            body: `Your proof for "${goal.title}" has been verified by admin.`,
            referenceId: goal._id,
        });

        res.status(200).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// @desc  Admin: reject proof — ask creator to re-upload
// @route PATCH /api/v1/admin/dream-funds/:id/reject-proof
const adminRejectProof = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const goal = await DreamFund.findByIdAndUpdate(
            req.params.id,
            { status: 'completed', 'proof.url': null, 'proof.type': null, actionedBy: req.user._id },
            { new: true }
        );
        if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

        await sendNotification({
            recipientId: goal.creatorId,
            type: 'dream_fund_proof_rejected',
            title: '⚠️ Proof Re-upload Required',
            body: reason ? `Re-upload proof for "${goal.title}": ${reason}` : `Please re-upload proof for "${goal.title}".`,
            referenceId: goal._id,
        });

        res.status(200).json({ success: true, data: goal });
    } catch (err) {
        next(err);
    }
};

// Export multer middleware for use in routes
const uploadMiddleware = upload.single('file');

module.exports = {
    // Creator
    createGoal,
    getMyGoals,
    updateGoal,
    uploadProof,
    uploadMiddleware,
    // Public
    getCreatorGoals,
    getTopContributors,
    getRecentContributions,
    // Payment
    createContributionOrder,
    verifyContribution,
    // Admin
    adminListDreamFunds,
    adminApproveGoal,
    adminRejectGoal,
    adminVerifyProof,
    adminRejectProof,
};
