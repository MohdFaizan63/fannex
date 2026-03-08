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

module.exports = { createOrder, verifyPayment, cancelSubscription, handleWebhook, checkSubscriptionStatus, createGiftOrder, verifyGift, createWalletOrder, verifyWalletRecharge, getWalletBalance };

// ─────────────────────────────────────────────────────────────────────────────
// GIFT PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Razorpay order for a gift to a creator
// @route POST /api/payment/gift-order
// @access Private (user)
async function createGiftOrder(req, res, next) {
    try {
        const { creatorId, amount } = req.body;
        const userId = req.user._id;

        if (!creatorId || !amount || amount < 1) {
            return res.status(400).json({ success: false, message: 'Invalid gift amount' });
        }

        const creatorProfile = await CreatorProfile.findOne({ userId: creatorId });
        if (!creatorProfile) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        const minGift = creatorProfile.minGift ?? 50;
        const maxGift = creatorProfile.maxGift ?? 10000;
        if (amount < minGift || amount > maxGift) {
            return res.status(400).json({ success: false, message: `Gift must be between ₹${minGift} and ₹${maxGift}` });
        }

        const order = await paymentService.createOrder({
            amount,
            currency: 'INR',
            receipt: `gift_${userId.toString().slice(-6)}_${Date.now().toString().slice(-8)}`,
            notes: { userId: userId.toString(), creatorId: creatorId.toString(), type: 'gift' },
        });

        res.status(200).json({
            success: true,
            data: {
                order: { id: order.id, amount: order.amount, currency: order.currency },
                keyId: process.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (err) {
        next(err);
    }
}

// @desc  Verify gift payment and credit creator
// @route POST /api/payment/gift-verify
// @access Private (user)
async function verifyGift(req, res, next) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, creatorId, amount } = req.body;
        const userId = req.user._id;

        const isValid = paymentService.verifyPaymentSignature({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });
        if (!isValid) return res.status(400).json({ success: false, message: 'Invalid payment signature' });

        const Payment = require('../models/Payment');
        const Earnings = require('../models/Earnings');

        await Payment.create({
            userId,
            creatorId,
            amount,
            currency: 'INR',
            type: 'gift',
            giftAmount: amount,
            status: 'captured',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });

        // Credit creator earnings (90% to creator, platform keeps 10%)
        const creatorCut = Math.floor(amount * 0.9);
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: creatorCut, pendingAmount: creatorCut } },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: 'Gift sent successfully!' });
    } catch (err) {
        next(err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET RECHARGE
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Razorpay order for wallet top-up
// @route POST /api/payment/wallet-order
// @access Private (user)
async function createWalletOrder(req, res, next) {
    try {
        const { amount } = req.body;
        const userId = req.user._id;

        const parsed = Number(amount);
        if (!parsed || parsed < 10 || !Number.isInteger(parsed)) {
            return res.status(400).json({ success: false, message: 'Minimum recharge amount is ₹10 (whole numbers only)' });
        }

        const order = await paymentService.createOrder({
            amount: parsed,
            currency: 'INR',
            receipt: `wallet_${userId.toString().slice(-6)}_${Date.now().toString().slice(-8)}`,
            notes: { userId: userId.toString(), type: 'wallet' },
        });

        res.status(200).json({
            success: true,
            data: {
                order: { id: order.id, amount: order.amount, currency: order.currency },
                keyId: process.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (err) {
        next(err);
    }
}

// @desc  Verify wallet recharge and credit balance
// @route POST /api/payment/wallet-verify
// @access Private (user)
async function verifyWalletRecharge(req, res, next) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const User = require('../models/User');

        const isValid = paymentService.verifyPaymentSignature({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });
        if (!isValid) return res.status(400).json({ success: false, message: 'Invalid payment signature' });

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { walletBalance: Number(amount) } },
            { new: true }
        );

        res.status(200).json({ success: true, data: { walletBalance: user.walletBalance } });
    } catch (err) {
        next(err);
    }
}

// @desc  Get current user wallet balance
// @route GET /api/payment/wallet-balance
// @access Private (user)
async function getWalletBalance(req, res, next) {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user._id).select('walletBalance');
        res.status(200).json({ success: true, data: { walletBalance: user?.walletBalance ?? 0 } });
    } catch (err) {
        next(err);
    }
}

