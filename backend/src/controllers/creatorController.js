const paginate = require('../utils/paginate');
const CreatorProfile = require('../models/CreatorProfile');
const Subscription = require('../models/Subscription');
const ProfileView = require('../models/ProfileView');
const Payment = require('../models/Payment');
const { optimizeImageUrl } = require('../utils/optimizeMediaUrl');
const {
    getMyEarningsService,
    requestPayoutService,
    listPayoutsService,
} = require('../services/earningsService');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in creator's earnings summary + per-type breakdown
// @route   GET /api/v1/creator/earnings
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const getMyEarnings = async (req, res, next) => {
    try {
        const creatorId = req.user._id;

        // Bug 5 Fix: fetch earnings + per-type breakdown in ONE controller call
        // so the frontend needs only this single endpoint (no separate loadBreakdown call).
        const [earnings, breakdownAgg] = await Promise.all([
            getMyEarningsService(creatorId),
            // Per-type breakdown for the 3 stat cards (Subscription / Gift / Chat)
            require('../models/Payment').aggregate([
                { $match: { creatorId, status: 'captured', type: { $in: ['subscription', 'gift', 'chat_unlock'] } } },
                { $group: { _id: '$type', total: { $sum: '$creatorEarning' } } },
            ]),
        ]);

        const breakdown = { subscription: 0, gift: 0, chat_unlock: 0 };
        breakdownAgg.forEach(({ _id, total }) => {
            if (_id in breakdown) breakdown[_id] = Math.round(total * 100) / 100;
        });

        res.status(200).json({ success: true, data: { ...earnings, breakdown } });
    } catch (error) {
        if (error.statusCode) res.status(error.statusCode);
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Creator requests a payout
// @route   POST /api/v1/creator/request-payout
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const requestPayout = async (req, res, next) => {
    try {
        // ── Guard: only KYC-verified creators may request a payout ─────────────────
        if (!req.user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Your account must be verified (KYC approved) before you can request a payout.',
            });
        }

        const { amount } = req.body;
        const parsedAmount = Number(amount);

        if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive payout amount is required.' });
        }

        // Cap to 2 decimal places to avoid floating-point ledger drift
        const safeAmount = Math.round(parsedAmount * 100) / 100;

        const payoutRequest = await requestPayoutService(req.user._id, safeAmount);

        res.status(201).json({
            success: true,
            message: 'Payout request submitted. An admin will review it shortly.',
            data: payoutRequest,
        });
    } catch (error) {
        if (error.statusCode) res.status(error.statusCode);
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    List creator's own payout requests (paginated)
// @route   GET /api/v1/creator/payouts
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const listMyPayouts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await listPayoutsService(req.user._id, page, limit);

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        if (error.statusCode) res.status(error.statusCode);
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    List all creator profiles (public, paginated + searchable)
// @route   GET /api/v1/creator/list
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const listCreators = async (req, res, next) => {
    try {
        // Base filter — only show approved creators on the public page
        const filter = { verificationStatus: 'approved' };

        // Category filter (frontend sends e.g. category=Gaming)
        if (req.query.category && req.query.category !== 'All') {
            filter.genre = req.query.category.toLowerCase();
        }

        const hasSearch = !!(req.query.search && req.query.search.trim());

        const data = await paginate(CreatorProfile, filter, {
            page: req.query.page,
            limit: req.query.limit,
            sort: hasSearch ? undefined : (req.query.sort || '-totalSubscribers'),
            // Use $text index search when query present (much faster than $regex)
            ...(hasSearch ? {
                useTextSearch: true,
                searchQuery: req.query.search,
            } : {}),
            populate: { path: 'userId', select: 'name email' },
            // Only select fields the Explore card UI actually needs
            select: 'displayName username profileImage coverImage totalSubscribers subscriptionPrice genre userId',
        });

        // Optimise Cloudinary CDN URLs
        data.results = data.results.map((c) => ({
            ...c,
            profileImage: optimizeImageUrl(c.profileImage),
            coverImage: optimizeImageUrl(c.coverImage),
        }));

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single creator profile by username (public)
// @route   GET /api/v1/creator/profile/:username
// @access  Public (optionally authenticated to check isSubscribed)
// ─────────────────────────────────────────────────────────────────────────────
const getCreatorByUsername = async (req, res, next) => {
    try {
        const { username } = req.params;
        const profile = await CreatorProfile
            .findOne({ username: username.toLowerCase(), verificationStatus: 'approved' })
            .populate('userId', 'name email');

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Creator not found.' });
        }

        let isSubscribed = false;
        if (req.user) {
            // Subscription.creatorId stores the creator's User._id (ref: 'User')
            // profile.userId is the User doc — use its _id, not profile._id (CreatorProfile doc)
            const creatorUserId = profile.userId?._id || profile.userId;
            const sub = await Subscription.findOne({
                userId: req.user._id,
                creatorId: creatorUserId,
                status: 'active',
            });
            isSubscribed = !!sub;
        }

        // Record profile view (fire-and-forget — don't block response)
        const creatorUserId = profile.userId?._id || profile.userId;
        const dateKey = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
        ProfileView.create({
            creatorId: creatorUserId,
            visitorId: req.user?._id || null,
            dateKey,
        }).catch(() => { }); // duplicate key = same user already viewed today → silently ignore

        res.json({
            success: true,
            data: {
                _id: profile._id,
                userId: profile.userId?._id || profile.userId,
                username: profile.username,
                displayName: profile.displayName,
                bio: profile.bio,
                instagramUrl: profile.instagramUrl || '',
                profileImage: optimizeImageUrl(profile.profileImage),
                coverImage: optimizeImageUrl(profile.coverImage),
                subscriptionPrice: profile.subscriptionPrice,
                totalSubscribers: profile.totalSubscribers,
                totalPosts: profile.totalPosts,
                creatorType: profile.creatorType,
                isSubscribed,
            },
        });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get random suggested creators (approved, excluding given username)
// @route   GET /api/v1/creator/suggested?exclude=username
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getSuggestedCreators = async (req, res, next) => {
    try {
        const { exclude } = req.query;
        const match = { verificationStatus: 'approved' };
        if (exclude) match.username = { $ne: exclude.toLowerCase() };

        const creators = await CreatorProfile.aggregate([
            { $match: match },
            { $sample: { size: 6 } },
            {
                $project: {
                    displayName: 1, username: 1, profileImage: 1, coverImage: 1,
                    totalSubscribers: 1, subscriptionPrice: 1, genre: 1,
                }
            },
        ]);

        // Optimise CDN URLs
        const optimized = creators.map((c) => ({
            ...c,
            profileImage: optimizeImageUrl(c.profileImage),
            coverImage: optimizeImageUrl(c.coverImage),
        }));

        res.json({ success: true, data: optimized });
    } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in user's own subscriptions (paginated)
// @route   GET /api/v1/creator/my-subscriptions
// @access  Private (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────
const mySubscriptions = async (req, res, next) => {
    try {
        // BUG-9 FIX: Filter by status:'active' so expired/canceled subs don't show
        const data = await paginate(
            Subscription,
            { userId: req.user._id, status: 'active', expiresAt: { $gt: new Date() } },
            {
                page: req.query.page,
                limit: req.query.limit,
                sort: req.query.sort || '-createdAt',
                populate: { path: 'creatorId', select: 'name email' },
            }
        );

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get subscribers to this creator's content (paginated)
// @route   GET /api/v1/creator/my-subscribers
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const myCreatorSubscribers = async (req, res, next) => {
    try {
        // Find the creator profile for the logged-in user
        const creatorProfile = await CreatorProfile.findOne({ userId: req.user._id }).select('_id userId');
        if (!creatorProfile) {
            return res.status(404).json({ success: false, message: 'Creator profile not found.' });
        }

        // Subscriptions where creatorId = this creator's User _id
        const data = await paginate(
            Subscription,
            { creatorId: req.user._id, status: 'active' },
            {
                page: req.query.page,
                limit: req.query.limit || 10,
                sort: req.query.sort || '-createdAt',
                populate: { path: 'userId', select: 'name email profileImage' },
            }
        );

        // Rename 'userId' → 'subscriberId' for clarity in the frontend
        const results = (data.results || []).map(sub => ({
            _id: sub._id,
            subscriberId: sub.userId,
            createdAt: sub.createdAt,
            expiresAt: sub.expiresAt,
            status: sub.status,
        }));

        res.status(200).json({ success: true, ...data, results });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Check if a username is available
// @route   GET /api/v1/creator/check-username?username=xxx
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const checkUsername = async (req, res, next) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ success: false, message: 'username query param required' });

        // Basic format check
        if (!/^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(username)) {
            return res.json({ success: true, available: false, reason: 'invalid_format' });
        }

        const exists = await CreatorProfile.findOne({ username: username.toLowerCase() });
        res.json({ success: true, available: !exists });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit a creator onboarding application
// @route   POST /api/v1/creator/apply
// @access  Private (authenticated user, not yet a creator)
// ─────────────────────────────────────────────────────────────────────────────
const User = require('../models/User');
const applyForCreator = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const currentUser = await User.findById(userId);

        // Block if already approved
        if (currentUser.creatorApplicationStatus === 'approved' || currentUser.role === 'creator') {
            return res.status(400).json({ success: false, message: 'You are already a creator.' });
        }
        // Block duplicate pending application
        if (currentUser.creatorApplicationStatus === 'pending') {
            return res.status(400).json({ success: false, message: 'Your application is already under review.' });
        }

        const {
            countryOfResidency, creatorType, displayName, username,
            bio, subscriptionPrice,
            fullName, panNumber, aadhaarNumber, bankAccountNumber, ifscCode,
        } = req.body;

        if (!username) return res.status(400).json({ success: false, message: 'username is required' });

        // Check username collision (ignore own profile when reapplying)
        const taken = await CreatorProfile.findOne({ username: username.toLowerCase(), userId: { $ne: userId } });
        if (taken) return res.status(400).json({ success: false, message: 'Username is already taken.' });

        // ── Upload KYC document images to Cloudinary (from memory buffer) ────────
        // applyUpload uses memoryStorage, so files are in req.files[field][0].buffer.
        // We push them to Cloudinary here so the admin panel can view the documents.
        const cloudinary = require('../config/cloudinary');
        const uploadToCloudinary = (buffer, publicId) =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'fannex/kyc-documents',
                        public_id: publicId,
                        resource_type: 'image',
                        access_mode: 'authenticated', // private — requires signed URL
                    },
                    (err, result) => (err ? reject(err) : resolve(result.secure_url))
                );
                stream.end(buffer);
            });

        const getImageUrl = async (fieldname) => {
            const file = req.files?.[fieldname]?.[0];
            if (!file?.buffer) return '';
            try {
                return await uploadToCloudinary(file.buffer, `${userId}_${fieldname}_${Date.now()}`);
            } catch (uploadErr) {
                console.error(`[applyForCreator] Cloudinary upload failed for ${fieldname}:`, uploadErr.message);
                return ''; // non-fatal — image upload failure shouldn't block application
            }
        };

        const [aadhaarImageUrl, panImageUrl, bankProofImageUrl] = await Promise.all([
            getImageUrl('aadhaarImage'),
            getImageUrl('panImage'),
            getImageUrl('bankProofImage'),
        ]);

        // Upsert creator profile (handles first-time and reapply)
        const profile = await CreatorProfile.findOneAndUpdate(
            { userId },
            {
                displayName,
                username: username.toLowerCase(),
                bio: bio || '',
                subscriptionPrice: Number(subscriptionPrice),
                countryOfResidency,
                creatorType,
                verificationStatus: 'pending',
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // ── Upsert CreatorVerification so admin panel can review KYC docs ──────
        const CreatorVerification = require('../models/CreatorVerification');
        await CreatorVerification.findOneAndUpdate(
            { userId },
            {
                aadhaarNumber,
                panNumber,
                bankAccountNumber,
                ifscCode: (ifscCode || '').toUpperCase(),
                accountHolderName: (fullName || '').trim(), // fullName → accountHolderName
                aadhaarImageUrl,
                panImageUrl,
                bankProofImageUrl,
                status: 'pending',
                rejectionReason: null,
                approvedBy: null,
                approvedAt: null,
                submittedAt: new Date(),
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // Set user application status to 'pending' — do NOT upgrade role yet
        await User.findByIdAndUpdate(userId, {
            creatorApplicationStatus: 'pending',
            creatorRejectionReason: '',
        });

        res.status(201).json({
            success: true,
            message: 'Creator application submitted successfully. Pending admin review.',
            data: { profileId: profile._id, creatorApplicationStatus: 'pending' },
        });
    } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Admin: approve or reject a creator application
// @route   PATCH /api/v1/creator/:userId/review
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────────────────
const reviewCreatorApplication = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action must be approve or reject' });
        }

        if (action === 'approve') {
            await User.findByIdAndUpdate(userId, {
                role: 'creator',
                creatorApplicationStatus: 'approved',
                creatorRejectionReason: '',
            });
            await CreatorProfile.findOneAndUpdate({ userId }, { verificationStatus: 'approved' });
            return res.json({ success: true, message: 'Creator application approved.' });
        }

        // Reject
        await User.findByIdAndUpdate(userId, {
            creatorApplicationStatus: 'rejected',
            creatorRejectionReason: rejectionReason || 'Application did not meet our requirements.',
        });
        await CreatorProfile.findOneAndUpdate({ userId }, { verificationStatus: 'rejected' });
        return res.json({ success: true, message: 'Creator application rejected.' });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current user's creator application status
// @route   GET /api/v1/creator/status
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getCreatorApplicationStatus = async (req, res, next) => {
    try {
        const profile = await CreatorProfile.findOne({ userId: req.user._id })
            .select('displayName username verificationStatus profileImage profileImagePosition coverImage coverImagePosition bio subscriptionPrice totalSubscribers totalPosts createdAt');

        if (!profile) return res.json({ success: true, data: null });

        // Also attach bank/identity verification data so PayoutSettings can
        // show the current bank account without a separate API call.
        const CreatorVerification = require('../models/CreatorVerification');
        const verification = await CreatorVerification.findOne({ userId: req.user._id })
            .select('bankAccountNumber ifscCode bankProofImageUrl accountHolderName bankName status');

        const data = profile.toObject();
        if (verification) {
            data.verificationData = {
                bankAccountNumber: verification.bankAccountNumber || '',
                ifscCode: verification.ifscCode || '',
                bankProofImageUrl: verification.bankProofImageUrl || '',
                accountHolderName: verification.accountHolderName || '',
                bankName: verification.bankName || '',
                status: verification.status || '',
            };
        } else {
            data.verificationData = null;
        }

        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update creator profile (bio, displayName, profileImage, bannerImage)
// @route   PATCH /api/v1/creator/profile
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const updateCreatorProfile = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { bio, displayName, coverImagePosition, profileImagePosition, subscriptionPrice, instagramUrl } = req.body;

        const hasCloudinary =
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET;

        const buildUrl = (file) => {
            if (!file) return undefined;
            return hasCloudinary
                ? file.path
                : `${process.env.API_BASE_URL || 'http://localhost:8080'}/uploads/${file.filename}`;
        };

        const updates = {};
        if (bio !== undefined) updates.bio = bio;
        if (displayName !== undefined) updates.displayName = displayName;
        if (instagramUrl !== undefined) {
            let ig = instagramUrl.trim();
            if (ig) {
                // Extract just the username from any Instagram URL format
                // Handles: handle, @handle, https://instagram.com/handle, https://instagram.com/handle?igsh=...
                const m = ig.match(/instagram\.com\/([^/?#\s]+)/);
                const handle = m ? m[1] : ig.replace(/^@/, '').split(/[/?#\s]/)[0];
                updates.instagramUrl = handle ? `https://www.instagram.com/${handle}` : '';
            } else {
                updates.instagramUrl = '';
            }
        }
        if (coverImagePosition !== undefined) updates.coverImagePosition = Number(coverImagePosition);
        if (profileImagePosition !== undefined) updates.profileImagePosition = Number(profileImagePosition);
        if (subscriptionPrice !== undefined && !isNaN(Number(subscriptionPrice))) {
            updates.subscriptionPrice = Math.max(1, Number(subscriptionPrice));
        }

        const profileFile = req.files?.profileImage?.[0];
        const bannerFile = req.files?.bannerImage?.[0];
        if (profileFile) updates.profileImage = buildUrl(profileFile);
        if (bannerFile) updates.coverImage = buildUrl(bannerFile);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update.' });
        }

        const profile = await CreatorProfile.findOneAndUpdate(
            { userId },
            { $set: updates },
            { returnDocument: 'after' }
        );

        if (!profile) return res.status(404).json({ success: false, message: 'Creator profile not found.' });

        res.json({ success: true, data: profile });
    } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get paginated earning history transactions for the logged-in creator
// @route   GET /api/v1/creator/earnings-history
// @access  Private (creator)
// Query params: type (subscription|gift|chat_unlock|all), page, limit
// ─────────────────────────────────────────────────────────────────────────────
const getEarningsHistory = async (req, res, next) => {
    try {
        const creatorId = req.user._id;
        const type      = req.query.type   || 'all';
        const page      = Math.max(1, parseInt(req.query.page,  10) || 1);
        const limit     = Math.min(50, parseInt(req.query.limit, 10) || 20);
        const skip      = (page - 1) * limit;

        // ── Single faceted aggregation — ONE round-trip to MongoDB ─────────────
        // Facets: transactions (paginated) + total count + per-type breakdown
        //
        // Bug 2 Fix: restrict matchBase to only the 3 earning types.
        // Without this, dream_fund payments appeared in the transactions list
        // showing as mysterious +₹0.00 DREAM_FUND entries.
        // Bug 3 Fix: removed unused `matchPage` variable (was never referenced).
        const matchBase = {
            creatorId,
            status: 'captured',
            type:   { $in: ['subscription', 'gift', 'chat_unlock'] },
        };

        const [result] = await Payment.aggregate([
            // Stage 1: narrow by creatorId + status + type (uses compound index)
            { $match: matchBase },

            // Stage 2: parallel facets
            { $facet: {
                // Paginated transactions for the selected type
                transactions: [
                    ...(type !== 'all' ? [{ $match: { type } }] : []),
                    { $sort:  { createdAt: -1 } },
                    { $skip:  skip },
                    { $limit: limit },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId', pipeline: [{ $project: { name: 1, username: 1, profileImage: 1 } }] } },
                    { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
                ],
                // Total count (for pagination bar)
                totalCount: [
                    ...(type !== 'all' ? [{ $match: { type } }] : []),
                    { $count: 'n' },
                ],
                // Per-type breakdown — always across all 3 types regardless of filter
                breakdown: [
                    { $group: {
                        _id: '$type',
                        total: { $sum: '$creatorEarning' },
                    }},
                ],
            }},
        ]);

        // Collapse breakdown array → { subscription, gift, chat_unlock }
        const breakdownMap = { subscription: 0, gift: 0, chat_unlock: 0 };
        (result?.breakdown ?? []).forEach(({ _id, total }) => {
            if (_id in breakdownMap) breakdownMap[_id] = Math.round(total * 100) / 100;
        });

        const total = result?.totalCount?.[0]?.n ?? 0;

        res.json({
            success: true,
            data: {
                transactions: result?.transactions ?? [],
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                },
                breakdown: breakdownMap,
            },
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getMyEarnings, requestPayout, listMyPayouts, listCreators, mySubscriptions, myCreatorSubscribers,
    checkUsername, applyForCreator, getCreatorApplicationStatus, reviewCreatorApplication,
    getCreatorByUsername, getSuggestedCreators, updateCreatorProfile,
    getEarningsHistory,
};
