const CreatorVerification = require('../models/CreatorVerification');

/**
 * checkCreatorVerified middleware
 *
 * Guards routes that require the creator to be KYC-approved.
 * Must be used AFTER the `protect` middleware (req.user must exist).
 *
 * Usage:
 *   router.post('/payout', protect, authorize('creator'), checkCreatorVerified, controller);
 */
const checkCreatorVerified = async (req, res, next) => {
    try {
        // 1. Only creators need this check
        if (req.user.role !== 'creator') {
            return res.status(403).json({
                success: false,
                message: 'Access denied — this route is for creators only',
            });
        }

        // 2. Look up the verification record
        const verification = await CreatorVerification.findOne({
            userId: req.user._id,
        }).select('status');

        if (!verification) {
            return res.status(403).json({
                success: false,
                message: 'Access denied — please submit your KYC documents first',
            });
        }

        if (verification.status === 'pending') {
            return res.status(403).json({
                success: false,
                message: 'Access denied — your KYC verification is under review',
            });
        }

        if (verification.status === 'rejected') {
            return res.status(403).json({
                success: false,
                message: 'Access denied — your KYC verification was rejected. Please re-submit corrected documents.',
            });
        }

        if (verification.status !== 'approved') {
            return res.status(403).json({
                success: false,
                message: 'Access denied — KYC verification required',
            });
        }

        // 3. Attach verification info for downstream use
        req.verification = verification;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { checkCreatorVerified };
