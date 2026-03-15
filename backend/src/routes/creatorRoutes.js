const express = require('express');
const router = express.Router();
const {
    getMyEarnings, requestPayout, listMyPayouts, listCreators, mySubscriptions, myCreatorSubscribers,
    checkUsername, applyForCreator, getCreatorApplicationStatus, reviewCreatorApplication,
    getCreatorByUsername, getSuggestedCreators, updateCreatorProfile,
} = require('../controllers/creatorController');
const { protect, authorize, optionalProtect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/validate');
const { requestPayoutSchema } = require('../validators/payoutValidators');
const { applyUpload } = require('../middleware/verificationUploadMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const { cachePublic } = require('../middleware/cacheHeaders');
const redisCache = require('../middleware/redisCache');

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/list', cachePublic(60), redisCache(60), listCreators);
router.get('/check-username', checkUsername);
router.get('/suggested', cachePublic(60), redisCache(60), getSuggestedCreators);
router.get('/profile/:username', cachePublic(60), redisCache(60), optionalProtect, getCreatorByUsername);

// ── Authenticated (any logged-in user) ─────────────────────────────────────────
router.get('/my-subscriptions', protect, mySubscriptions);
// applyUpload parses multipart/form-data so req.body and req.files are populated
router.post('/apply', protect, applyUpload, applyForCreator);
router.get('/status', protect, getCreatorApplicationStatus);

// ── Creator-only ───────────────────────────────────────────────────────────────
router.use(protect);
router.use(authorize('creator'));

// Insights / analytics
const { getProfileViews, getEarningsInsights, getOverview } = require('../controllers/insightsController');
router.get('/insights/profile-views', getProfileViews);
router.get('/insights/earnings', getEarningsInsights);
router.get('/insights/overview', getOverview);

router.get('/earnings', getMyEarnings);
router.get('/my-subscribers', myCreatorSubscribers);
router.post('/request-payout', validate(requestPayoutSchema), requestPayout);
router.get('/payouts', listMyPayouts);

// Profile & payout account updates
router.patch(
    '/profile',
    upload.fields([
        { name: 'profileImage', maxCount: 1 },
        { name: 'bannerImage', maxCount: 1 },
    ]),
    updateCreatorProfile
);
router.patch(
    '/payout-account',
    upload.fields([{ name: 'bankProofImage', maxCount: 1 }]),
    async (req, res, next) => {
        try {
            const CreatorVerification = require('../models/CreatorVerification');
            const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
            if (!accountNumber || !ifscCode || !accountHolderName) {
                return res.status(400).json({ success: false, message: 'accountHolderName, accountNumber and ifscCode are required.' });
            }
            const update = {
                bankAccountNumber: accountNumber,
                ifscCode: ifscCode.toUpperCase(),
                accountHolderName: accountHolderName.trim(),
                bankName: (bankName || '').trim(),
            };
            const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
            const bankProofFile = req.files?.bankProofImage?.[0];
            if (bankProofFile) {
                update.bankProofImageUrl = hasCloudinary
                    ? bankProofFile.path
                    : `${process.env.API_BASE_URL || 'http://localhost:8080'}/uploads/${bankProofFile.filename}`;
            }
            const verification = await CreatorVerification.findOneAndUpdate(
                { userId: req.user._id },
                { $set: update },
                { new: true, upsert: true, runValidators: true }
            );
            res.json({ success: true, data: verification });
        } catch (err) { next(err); }
    }
);

// ── Admin-only ─────────────────────────────────────────────────────────────────
// PATCH /api/v1/creator/:userId/review  { action: 'approve'|'reject', rejectionReason }
router.patch('/:userId/review', protect, authorize('admin'), reviewCreatorApplication);

module.exports = router;
