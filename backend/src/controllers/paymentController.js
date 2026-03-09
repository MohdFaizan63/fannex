/**
 * Payment Controller — Cashfree v3
 * All Razorpay references have been replaced.
 */
const paymentService = require('../services/paymentService');
const CreatorProfile = require('../models/CreatorProfile');

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order for a subscription payment
// @route POST /api/payment/create-order
// @access Private (user)
const createOrder = async (req, res, next) => {
    try {
        const { creatorId } = req.body;
        const user = req.user;

        const creatorProfile = await CreatorProfile.findOne({ userId: creatorId });
        if (!creatorProfile) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        const orderId = `sub_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: creatorProfile.subscriptionPrice,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                creatorId: creatorId.toString(),
                type: 'subscription',
            },
        });

        res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error('[createOrder] Error:', error.message);
        if (error.response?.data) {
            console.error('[createOrder] Cashfree response:', JSON.stringify(error.response.data, null, 2));
        }
        const message = error.response?.data?.message || error.message || 'Payment order creation failed';
        res.status(error.response?.status || 500).json({ success: false, message });
    }
};

// @desc  Verify payment after Cashfree redirect/webhook — activate subscription or chat unlock
// @route POST /api/payment/verify
// @access Private (user)
const verifyPayment = async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const userId = req.user._id;

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }

        // Fetch order status from Cashfree
        const orderData = await paymentService.getOrderStatus(orderId);

        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: `Payment not completed. Status: ${orderData.order_status}`,
            });
        }

        // Extract metadata from order_tags (stored when we created the order)
        const tags = orderData.order_tags || {};
        const creatorId = req.body.creatorId || tags.creatorId;
        const type = tags.type || 'subscription';

        if (!creatorId) {
            return res.status(400).json({ success: false, message: 'Could not determine creator from order' });
        }

        // Fetch payment details to get cf_payment_id
        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch (e) {
            console.warn('[verifyPayment] Could not fetch payment details:', e.message);
        }

        const amount = orderData.order_amount;

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId,
            amount,
            meta: {
                userId: userId.toString(),
                creatorId: creatorId.toString(),
                type,
            },
        });

        // For chat_unlock orders, return the chatId so the frontend can redirect to the chat window
        if (type === 'chat_unlock') {
            const ChatRoom = require('../models/ChatRoom');
            const room = await ChatRoom.findOne({ creatorId, userId });
            return res.status(200).json({
                success: true,
                type: 'chat_unlock',
                chatId: room?._id ?? null,
                message: 'Chat unlocked successfully',
            });
        }

        // For subscription orders, return creator info + chatId so success page can display creator profile
        if (type === 'subscription') {
            const ChatRoom = require('../models/ChatRoom');
            const [room, creatorProfile] = await Promise.all([
                ChatRoom.findOne({ creatorId, userId }),
                CreatorProfile.findOne({ userId: creatorId }).select('displayName username profileImage coverImage bio subscriptionPrice chatEnabled chatPrice'),
            ]);
            return res.status(200).json({
                success: true,
                type: 'subscription',
                chatId: room?._id ?? null,
                creator: {
                    id: creatorId,
                    name: creatorProfile?.displayName || 'the creator',
                    username: creatorProfile?.username || null,
                    profileImage: creatorProfile?.profileImage || null,
                    coverImage: creatorProfile?.coverImage || null,
                    bio: creatorProfile?.bio || null,
                    subscriptionPrice: creatorProfile?.subscriptionPrice || 0,
                    chatEnabled: creatorProfile?.chatEnabled ?? true,
                    chatPrice: creatorProfile?.chatPrice || 0,
                },
                message: 'Payment verified and subscription activated',
            });
        }

        // For gift orders, return creator info + amount so success page can show gift confirmation
        if (type === 'gift') {
            const creatorProfile = await CreatorProfile.findOne({ userId: creatorId })
                .select('displayName username profileImage');
            return res.status(200).json({
                success: true,
                type: 'gift',
                amount: orderData.order_amount,
                creator: {
                    id: creatorId,
                    name: creatorProfile?.displayName || 'the creator',
                    username: creatorProfile?.username || null,
                    profileImage: creatorProfile?.profileImage || null,
                },
                message: 'Gift sent successfully',
            });
        }

        // For wallet recharge orders, return updated balance
        if (type === 'wallet') {
            const User = require('../models/User');
            const user = await User.findById(userId).select('walletBalance');
            return res.status(200).json({
                success: true,
                type: 'wallet',
                walletBalance: user?.walletBalance ?? 0,
                amount: orderData.order_amount,
                message: 'Wallet recharged successfully',
            });
        }

        res.status(200).json({ success: true, type, message: 'Payment verified and subscription activated' });
    } catch (error) {
        console.error('[verifyPayment] Error:', error.message);
        if (error.response?.data) {
            console.error('[verifyPayment] API response:', JSON.stringify(error.response.data, null, 2));
        }
        const message = error.response?.data?.message || error.message || 'Payment verification failed';
        res.status(error.response?.status || 500).json({ success: false, message });
    }
};

// @desc  Cancel a subscription
// @route POST /api/payment/cancel
// @access Private (user)
const cancelSubscription = async (req, res, next) => {
    try {
        const { subscriptionId } = req.body;
        const result = await paymentService.cancelSubscription({ subscriptionId });
        res.status(200).json({ success: true, message: 'Subscription cancelled successfully', data: result });
    } catch (error) {
        next(error);
    }
};

// @desc  Cashfree Webhook handler (raw body required)
// @route POST /api/payment/webhook
// @access Public (Cashfree servers)
const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const timestamp = req.headers['x-webhook-timestamp'];
        const rawBody = req.rawBody;

        if (!paymentService.verifyWebhookSignature(rawBody, signature, timestamp)) {
            return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        }

        const event = req.body;
        const eventType = event?.type;

        // Cashfree webhook event types:
        // PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, PAYMENT_USER_DROPPED_WEBHOOK
        if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
            const data = event.data;
            const orderData = data.order;
            const paymentData = data.payment;

            const meta = orderData.order_tags || {};
            await paymentService.handlePaymentCaptured({
                orderId: orderData.order_id,
                cfPaymentId: paymentData.cf_payment_id?.toString(),
                amount: orderData.order_amount,
                meta,
            });
        }

        res.status(200).json({ success: true, received: true });
    } catch (error) {
        console.error('[handleWebhook] Error:', error.message);
        next(error);
    }
};

// @desc  Check if user is subscribed to a creator
// @route GET /api/payment/subscription-status/:creatorId
// @access Private (user)
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
                subscription: subscription ? { id: subscription._id, expiresAt: subscription.expiresAt } : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GIFT PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order for a gift to a creator
// @route POST /api/payment/gift-order
// @access Private (user)
async function createGiftOrder(req, res, next) {
    try {
        const { creatorId, amount } = req.body;
        const user = req.user;

        if (!creatorId || !amount || amount < 0.1) {
            return res.status(400).json({ success: false, message: 'Invalid gift amount' });
        }

        const creatorProfile = await CreatorProfile.findOne({ userId: creatorId });
        if (!creatorProfile) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        const minGift = creatorProfile.minGift ?? 0.1;
        const maxGift = creatorProfile.maxGift ?? 10000;
        if (amount < minGift || amount > maxGift) {
            return res.status(400).json({ success: false, message: `Gift must be between ₹${minGift} and ₹${maxGift}` });
        }

        const orderId = `gift_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                creatorId: creatorId.toString(),
                type: 'gift',
            },
        });

        res.status(200).json({ success: true, data: order });
    } catch (err) {
        next(err);
    }
}

// @desc  Verify gift payment after redirect
// @route POST /api/payment/gift-verify
// @access Private (user)
async function verifyGift(req, res, next) {
    try {
        const { orderId, creatorId, amount } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Gift payment not completed' });
        }

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId: orderData.payments?.[0]?.cf_payment_id?.toString() || null,
            amount,
            meta: { userId: userId.toString(), creatorId: creatorId.toString(), type: 'gift' },
        });

        res.status(200).json({ success: true, message: 'Gift sent successfully!' });
    } catch (err) {
        next(err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET RECHARGE
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create Cashfree order for wallet top-up
// @route POST /api/payment/wallet-order
// @access Private (user)
async function createWalletOrder(req, res, next) {
    try {
        const { amount } = req.body;
        const user = req.user;

        const parsed = Number(amount);
        if (!parsed || parsed < 1) {
            return res.status(400).json({ success: false, message: 'Minimum recharge amount is ₹1' });
        }

        const orderId = `wallet_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: parsed,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/subscription-success?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                type: 'wallet',
                creatorId: 'none',
            },
        });

        res.status(200).json({ success: true, data: order });
    } catch (err) {
        next(err);
    }
}

// @desc  Verify wallet recharge and credit balance
// @route POST /api/payment/wallet-verify
// @access Private (user)
async function verifyWalletRecharge(req, res, next) {
    try {
        const { orderId, amount } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Wallet recharge not completed' });
        }

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId: orderData.payments?.[0]?.cf_payment_id?.toString() || null,
            amount,
            meta: { userId: userId.toString(), type: 'wallet', creatorId: 'none' },
        });

        const User = require('../models/User');
        const user = await User.findById(userId).select('walletBalance');
        res.status(200).json({ success: true, data: { walletBalance: user?.walletBalance ?? 0 } });
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

module.exports = {
    createOrder,
    verifyPayment,
    cancelSubscription,
    handleWebhook,
    checkSubscriptionStatus,
    createGiftOrder,
    verifyGift,
    createWalletOrder,
    verifyWalletRecharge,
    getWalletBalance,
};
