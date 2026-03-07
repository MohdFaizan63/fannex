const paymentService = require('../services/paymentService');
const CreatorProfile = require('../models/CreatorProfile');

// @desc    Create Razorpay order for one-time subscription payment
// @route   POST /api/payment/create-order
// @access  Private (user)
const createOrder = async (req, res, next) => {
    try {
        const { creatorId } = req.body;
        const userId = req.user._id;

        const creatorProfile = await CreatorProfile.findOne({ userId: creatorId });
        if (!creatorProfile) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        const order = await paymentService.createOrder({
            amount: creatorProfile.subscriptionPrice,
            currency: 'INR',
            // Razorpay receipt max = 40 chars
            receipt: `sub_${userId.toString().slice(-6)}_${Date.now().toString().slice(-8)}`,
            notes: {
                userId: userId.toString(),
                creatorId: creatorId.toString(),
            },
        });

        res.status(200).json({
            success: true,
            data: {
                order: {
                    id: order.id,
                    amount: order.amount,
                    currency: order.currency,
                },
                keyId: process.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (error) {
        console.error('[createOrder] Error:', error?.error?.description || error.message, error);
        next(error);
    }
};

// @desc    Verify payment and activate subscription
// @route   POST /api/payment/verify
// @access  Private (user)
const verifyPayment = async (req, res, next) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, creatorId } = req.body;
        const userId = req.user._id;

        const isValid = paymentService.verifyPaymentSignature({
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
        });

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Store subscription & payment records
        await paymentService.handlePaymentCaptured({
            payment: {
                entity: {
                    id: razorpayPaymentId,
                    order_id: razorpayOrderId,
                    amount: req.body.amount,
                    currency: 'INR',
                    notes: {
                        userId: userId.toString(),
                        creatorId: creatorId.toString(),
                    },
                },
            },
        });

        res.status(200).json({ success: true, message: 'Payment verified and subscription activated' });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel a subscription
// @route   POST /api/payment/cancel
// @access  Private (user)
const cancelSubscription = async (req, res, next) => {
    try {
        const { subscriptionId } = req.body;

        const result = await paymentService.cancelSubscription({ subscriptionId });

        res.status(200).json({ success: true, message: 'Subscription cancelled successfully', data: result });
    } catch (error) {
        next(error);
    }
};

// @desc    Razorpay Webhook handler (raw body required)
// @route   POST /api/payment/webhook
// @access  Public (Razorpay server)
const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.rawBody; // set via express middleware

        const isValid = paymentService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === 'payment.captured') {
            await paymentService.handlePaymentCaptured(payload);
        }

        res.status(200).json({ success: true, received: true });
    } catch (error) {
        next(error);
    }
};

// @desc    Check if user is subscribed to a creator
// @route   GET /api/payment/subscription-status/:creatorId
// @access  Private (user)
const checkSubscriptionStatus = async (req, res, next) => {
    try {
        const { creatorId } = req.params;
        const userId = req.user._id;
        const Subscription = require('../models/Subscription');

        const subscription = await Subscription.findOne({
            userId,
            creatorId,
            status: 'active',
            expiresAt: { $gt: new Date() },
        });

        res.status(200).json({
            success: true,
            data: {
                subscribed: !!subscription,
                subscription: subscription ? {
                    id: subscription._id,
                    expiresAt: subscription.expiresAt,
                } : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createOrder, verifyPayment, cancelSubscription, handleWebhook, checkSubscriptionStatus };
