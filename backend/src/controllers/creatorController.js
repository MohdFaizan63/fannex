const paginate = require('../utils/paginate');
const CreatorProfile = require('../models/CreatorProfile');
const Subscription = require('../models/Subscription');
const ProfileView = require('../models/ProfileView');
const { optimizeImageUrl } = require('../utils/optimizeMediaUrl');
const {
    getMyEarningsService,
    requestPayoutService,
    listPayoutsService,
} = require('../services/earningsService');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in creator's earnings summary
// @route   GET /api/v1/creator/earnings
// @access  Private (creator)
// ─────────────────────────────────────────────────────────────────────────────
const getMyEarnings = async (req, res, next) => {
    try {
        const earnings = await getMyEarningsService(req.user._id);
        res.status(200).json({ success: true, data: earnings });
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
                // NOTE: PAN/Aadhaar/bank details are stored ONLY in CreatorVerification (encrypted)
                // and NOT in CreatorProfile.verificationData (removed — was plain text).
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // ── Also upsert a CreatorVerification record so admin panel can see it ──
        const CreatorVerification = require('../models/CreatorVerification');
        await CreatorVerification.findOneAndUpdate(
            { userId },
            {
                aadhaarNumber,
                panNumber,
                bankAccountNumber,
                ifscCode: (ifscCode || '').toUpperCase(),
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
            .select('displayName username verificationStatus profileImage profileImagePosition coverImage coverImagePosition bio subscriptionPrice totalSubscribers createdAt');

        if (!profile) return res.json({ success: true, data: null });
        res.json({ success: true, data: profile });
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
        const { bio, displayName, coverImagePosition, profileImagePosition, subscriptionPrice } = req.body;

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

module.exports = {
    getMyEarnings, requestPayout, listMyPayouts, listCreators, mySubscriptions, myCreatorSubscribers,
    checkUsername, applyForCreator, getCreatorApplicationStatus, reviewCreatorApplication,
    getCreatorByUsername, getSuggestedCreators, updateCreatorProfile,
};
