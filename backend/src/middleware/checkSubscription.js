const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

/**
 * checkSubscription middleware
 *
 * Usage in routes:
 *   const { checkSubscription } = require('../middleware/checkSubscription');
 *   router.get('/locked-content/:creatorId', checkSubscription, controller);
 *
 * It reads creatorId from:
 *   1. req.params.creatorId
 *   2. req.body.creatorId
 *   3. req.query.creatorId
 */
const checkSubscription = async (req, res, next) => {
    try {
        // ── Step 1: Verify JWT ──────────────────────────────────────────────
        let token;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — no token provided',
            });
        }

        let decoded;
        try {
            if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET is not set');
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — token is invalid or expired',
            });
        }

        // Attach user to request
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — user not found',
            });
        }
        req.user = user;

        // ── Step 2: Resolve creatorId ────────────────────────────────────────
        const creatorId =
            req.params.creatorId ||
            req.body.creatorId ||
            req.query.creatorId;

        if (!creatorId) {
            return res.status(400).json({
                success: false,
                message: 'creatorId is required for subscription check',
            });
        }

        // Admins and the creator themselves always pass through
        if (
            user.role === 'admin' ||
            user._id.toString() === creatorId.toString()
        ) {
            return next();
        }

        // ── Step 3: Check active subscription ───────────────────────────────
        const subscription = await Subscription.findOne({
            userId: user._id,
            creatorId,
            status: 'active',
            expiresAt: { $gt: new Date() }, // must not be expired
        });

        if (!subscription) {
            return res.status(403).json({
                success: false,
                message: 'Access denied — you need an active subscription to view this content',
            });
        }

        // Attach subscription info for downstream use
        req.subscription = subscription;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { checkSubscription };
