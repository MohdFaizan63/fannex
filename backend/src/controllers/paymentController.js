/**
 * Payment Controller — Cashfree v3
 * All Razorpay references have been replaced.
 */
const paymentService = require('../services/paymentService');
const { safeCfStatus } = paymentService;
const CreatorProfile = require('../models/CreatorProfile');
const User = require('../models/User');
const PaymentModel = require('../models/Payment');
const ChatRoom = require('../models/ChatRoom');
const Subscription = require('../models/Subscription');
const { calcGST } = require('../utils/gstHelper');

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

        // ── GUARD 1: Block duplicate subscription ────────────────────────────────
        // If the user already has a non-expired active subscription, refuse to
        // create another Cashfree order, preventing accidental double charges.
        const activeSub = await Subscription.findOne({
            userId: user._id,
            creatorId,
            status: 'active',
            expiresAt: { $gt: new Date() },
        }).select('_id expiresAt').lean();

        if (activeSub) {
            console.log(`[createOrder] Blocked duplicate sub userId=${user._id} creatorId=${creatorId}`);
            return res.status(409).json({
                success: false,
                alreadySubscribed: true,
                message: 'You already have an active subscription to this creator.',
                expiresAt: activeSub.expiresAt,
            });
        }

        // ── GUARD 2: Re-use an existing PENDING order (idempotent creation) ──────
        // If the same user+creator has an un-captured Payment doc created in the
        // last 10 minutes, re-fetch the Cashfree paymentSessionId instead of
        // creating a brand-new order. Prevents orphan orders on page refresh.
        const TEN_MIN_AGO = new Date(Date.now() - 10 * 60 * 1000);
        const pendingPayment = await PaymentModel.findOne({
            userId: user._id,
            creatorId,
            type: 'subscription',
            status: 'created',
            sideEffectsDone: false,
            createdAt: { $gte: TEN_MIN_AGO },
        }).select('cfOrderId').lean();

        if (pendingPayment?.cfOrderId) {
            try {
                const existingOrder = await paymentService.getOrderStatus(pendingPayment.cfOrderId);
                if (existingOrder.order_status === 'ACTIVE') {
                    // Re-use the existing session — do NOT create a new order
                    console.log(`[createOrder] Reusing existing order cfOrderId=${pendingPayment.cfOrderId}`);
                    return res.status(200).json({
                        success: true,
                        data: {
                            orderId: existingOrder.order_id,
                            paymentSessionId: existingOrder.payment_session_id,
                            amount: existingOrder.order_amount,
                            currency: existingOrder.order_currency,
                            cfMode: process.env.CASHFREE_ENV || 'production',
                            gstBreakdown: {
                                baseAmount:     calcGST(creatorProfile.subscriptionPrice).baseAmount,
                                gstAmount:      calcGST(creatorProfile.subscriptionPrice).gstAmount,
                                totalPaid:      calcGST(creatorProfile.subscriptionPrice).totalPaid,
                                platformFee:    calcGST(creatorProfile.subscriptionPrice).platformFee,
                                creatorEarning: calcGST(creatorProfile.subscriptionPrice).creatorEarning,
                            },
                        },
                    });
                }
            } catch (e) {
                // If re-fetch fails, fall through and create a fresh order
                console.warn(`[createOrder] Could not re-fetch existing order, creating new one: ${e.message}`);
            }
        }

        // Apply 18% GST on top of the creator-set subscription price
        const gst = calcGST(creatorProfile.subscriptionPrice);

        const orderId = `sub_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: gst.totalPaid,          // fan pays base + 18% GST
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
                baseAmount: gst.baseAmount.toString(), // stored for GST split on verify/webhook
            },
        });

        // ── Persist a Payment doc immediately after Cashfree creates the order ──
        // This allows Guard 2 (pending-order idempotency) in future createOrder
        // calls to find this doc and re-use the same Cashfree session, instead of
        // creating a brand-new orphan order if the user clicks Pay twice.
        // sideEffectsDone stays false — handlePaymentCaptured will flip it once paid.
        try {
            await PaymentModel.create({
                userId:         user._id,
                creatorId,
                amount:         gst.totalPaid,
                baseAmount:     gst.baseAmount,
                gstAmount:      gst.gstAmount,
                platformFee:    gst.platformFee,
                creatorEarning: gst.creatorEarning,
                currency:       'INR',
                type:           'subscription',
                status:         'created',
                cfOrderId:      order.orderId,
                sideEffectsDone: false,
            });
        } catch (dbErr) {
            // Non-fatal: if this insert fails (e.g. duplicate key), it's fine —
            // handlePaymentCaptured uses upsert and will create it on verify/webhook.
            console.warn('[createOrder] Payment doc pre-create failed (non-fatal):', dbErr.message);
        }

        // Return GST breakdown so the frontend can display it
        res.status(200).json({
            success: true,
            data: {
                ...order,
                gstBreakdown: {
                    baseAmount:     gst.baseAmount,
                    gstAmount:      gst.gstAmount,
                    totalPaid:      gst.totalPaid,
                    platformFee:    gst.platformFee,
                    creatorEarning: gst.creatorEarning,
                },
            },
        });
    } catch (error) {
        console.error('[createOrder] Error:', error.message);
        if (error.response?.data) {
            console.error('[createOrder] Cashfree response:', JSON.stringify(error.response.data, null, 2));
        }
        const message = error.response?.data?.message || error.message || 'Payment order creation failed';
        // Use safeCfStatus so Cashfree 401 (bad credentials) never reaches the
        // frontend as a 401 — that would trigger the global logout interceptor.
        res.status(safeCfStatus(error.response?.status) || 500).json({ success: false, message });
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

        console.log(`[verifyPayment] START orderId=${orderId} userId=${userId}`);

        // Fetch order status from Cashfree
        const orderData = await paymentService.getOrderStatus(orderId);
        console.log(`[verifyPayment] Cashfree status=${orderData.order_status} amount=${orderData.order_amount} orderId=${orderId}`);

        if (orderData.order_status !== 'PAID') {
            console.warn(`[verifyPayment] Order not PAID — status=${orderData.order_status} orderId=${orderId}`);
            return res.status(400).json({
                success: false,
                message: `Payment not completed. Status: ${orderData.order_status}`,
            });
        }

        // BUG 4 FIX: Cashfree occasionally returns order_tags as null (documented edge case).
        // Always fall back to {} so tag destructuring never throws.
        const tags = (orderData.order_tags && typeof orderData.order_tags === 'object')
            ? orderData.order_tags
            : {};

        const type = tags.type || 'subscription';
        console.log(`[verifyPayment] type=${type} tags=${JSON.stringify(tags)}`);

        // ── Handle wallet top-up early — no creatorId needed ─────────────────
        if (type === 'wallet') {
            const walletUserId = tags.userId || userId.toString();
            let cfPaymentId = null;
            try {
                const p = await paymentService.getOrderPayments(orderId);
                cfPaymentId = p?.[0]?.cf_payment_id?.toString() || null;
            } catch { /* optional */ }
            await paymentService.handlePaymentCaptured({
                orderId,
                cfPaymentId,
                amount: orderData.order_amount,
                meta: { userId: walletUserId, type: 'wallet', creatorId: null },
            });
            const freshUser = await User.findById(walletUserId).select('walletBalance');
            console.log(`[verifyPayment] Wallet recharged userId=${walletUserId} newBalance=${freshUser?.walletBalance}`);
            return res.status(200).json({
                success: true,
                type: 'wallet',
                walletBalance: Math.round(freshUser?.walletBalance ?? 0),
                amount: orderData.order_amount,
                message: 'Wallet recharged successfully',
            });
        }

        // BUG 5 FIX: creatorId can be null if order_tags were lost (Bug 4 scenario).
        // Prefer req.body.creatorId sent by frontend, then fall back to tags.
        // If still missing, return a detailed error so logs are actionable.
        const creatorId = req.body.creatorId || tags.creatorId;

        if (!creatorId) {
            console.error(`[verifyPayment] MISSING creatorId — tags=${JSON.stringify(tags)} orderId=${orderId}`);
            return res.status(400).json({
                success: false,
                message: 'Could not determine creator from order. Please contact support@fannex.in with your order ID.',
                orderId,
            });
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
        console.log(`[verifyPayment] Calling handlePaymentCaptured orderId=${orderId} type=${type} creatorId=${creatorId} amount=${amount}`);

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId,
            amount,
            meta: {
                userId: userId.toString(),
                creatorId: creatorId.toString(),
                type,
                baseAmount: tags.baseAmount || null,  // pass through for GST split
            },
        });

        console.log(`[verifyPayment] handlePaymentCaptured done orderId=${orderId} type=${type}`);

        // For chat_unlock orders, return the chatId so the frontend can redirect to the chat window
        if (type === 'chat_unlock') {
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
            const [room, creatorProfile] = await Promise.all([
                ChatRoom.findOne({ creatorId, userId }),
                CreatorProfile.findOne({ userId: creatorId }).select('displayName username profileImage coverImage bio subscriptionPrice chatEnabled chatPrice'),
            ]);
            console.log(`[verifyPayment] SUCCESS subscription userId=${userId} creatorId=${creatorId} chatId=${room?._id}`);
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

        // For gift orders, return creator info + BASE amount so success page shows what the fan gifted
        if (type === 'gift') {
            const creatorProfile = await CreatorProfile.findOne({ userId: creatorId })
                .select('displayName username profileImage');
            // Extract the base amount (before GST) from order tags — that's what the fan intended to give
            const tags = (orderData.order_tags && typeof orderData.order_tags === 'object') ? orderData.order_tags : {};
            const baseAmount = tags.baseAmount
                ? Number(tags.baseAmount)
                : Math.round(orderData.order_amount / 1.18 * 100) / 100;
            console.log(`[verifyPayment] SUCCESS gift userId=${userId} creatorId=${creatorId} base=₹${baseAmount}`);
            return res.status(200).json({
                success: true,
                type: 'gift',
                amount: baseAmount,           // base amount (₹1), NOT total paid (₹1.18)
                totalPaid: orderData.order_amount,  // for reference if needed
                creator: {
                    id: creatorId,
                    name: creatorProfile?.displayName || 'the creator',
                    username: creatorProfile?.username || null,
                    profileImage: creatorProfile?.profileImage || null,
                },
                message: 'Gift sent successfully',
            });
        }


        res.status(200).json({ success: true, type, message: 'Payment verified and subscription activated' });
    } catch (error) {
        console.error('[verifyPayment] UNCAUGHT ERROR:', error.message);
        if (error.response?.data) {
            console.error('[verifyPayment] Cashfree API response:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('[verifyPayment] Stack:', error.stack);
        const message = error.response?.data?.message || error.message || 'Payment verification failed';
        res.status(safeCfStatus(error.response?.status) || 500).json({ success: false, message });
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

        // Apply 18% GST on fan-entered gift base amount
        const gst = calcGST(Number(amount));

        const orderId = `gift_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: gst.totalPaid,    // fan pays base + 18% GST
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
                baseAmount: gst.baseAmount.toString(), // stored for GST split on verify/webhook
            },
        });

        res.status(200).json({
            success: true,
            data: {
                ...order,
                gstBreakdown: {
                    baseAmount:     gst.baseAmount,
                    gstAmount:      gst.gstAmount,
                    totalPaid:      gst.totalPaid,
                    platformFee:    gst.platformFee,
                    creatorEarning: gst.creatorEarning,
                },
            },
        });
    } catch (err) {
        next(err);
    }
}

// @desc  Verify gift payment after redirect
// @route POST /api/payment/gift-verify
// @access Private (user)
async function verifyGift(req, res, next) {
    try {
        const { orderId, creatorId } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Gift payment not completed' });
        }

        const verifiedAmount = orderData.order_amount;
        const tags = orderData.order_tags || {};

        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch { /* ignore */ }

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId,
            amount: verifiedAmount,
            meta: {
                userId: userId.toString(),
                creatorId: creatorId.toString(),
                type: 'gift',
                baseAmount: tags.baseAmount || null, // pass through for GST split
            },
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
        if (isNaN(parsed) || parsed <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
        if (parsed < 1) {
            return res.status(400).json({ success: false, message: 'Minimum recharge amount is ₹1 (payment gateway limit)' });
        }
        if (parsed > 50000) {
            return res.status(400).json({ success: false, message: 'Maximum recharge amount is ₹50,000' });
        }

        const orderId = `wallet_${user._id.toString().slice(-6)}_${Date.now()}`;

        const order = await paymentService.createOrder({
            amount: parsed,
            orderId,
            customerId: user._id.toString(),
            customerName: user.name || 'Fannex User',
            customerEmail: user.email || 'user@fannex.in',
            customerPhone: user.phone || '9000000000',
            returnUrl: `${(process.env.CLIENT_URL || '').split(',')[0].trim()}/wallet?order_id={order_id}`,
            meta: {
                userId: user._id.toString(),
                type: 'wallet',
            },
        });

        res.status(200).json({ success: true, data: order });
    } catch (err) {
        // Use safeCfStatus so Cashfree 401 never triggers the frontend logout interceptor
        const cfMessage = err?.response?.data?.message;
        const upstreamStatus = err?.response?.status;
        if (cfMessage) {
            return res.status(safeCfStatus(upstreamStatus) || 400).json({ success: false, message: cfMessage });
        }
        next(err);
    }
}

// @desc  Verify wallet recharge and credit balance
// @route POST /api/payment/wallet-verify
// @access Private (user)
async function verifyWalletRecharge(req, res, next) {
    try {
        const { orderId } = req.body;
        const userId = req.user._id;

        const orderData = await paymentService.getOrderStatus(orderId);
        if (orderData.order_status !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Wallet recharge not completed' });
        }

        // BUG-1 FIX: Use Cashfree-verified amount — never trust client-supplied amount
        const verifiedAmount = orderData.order_amount;

        // Fetch cfPaymentId for idempotency
        let cfPaymentId = null;
        try {
            const payments = await paymentService.getOrderPayments(orderId);
            cfPaymentId = payments?.[0]?.cf_payment_id?.toString() || null;
        } catch { /* optional */ }

        await paymentService.handlePaymentCaptured({
            orderId,
            cfPaymentId,
            amount: verifiedAmount,
            meta: { userId: userId.toString(), type: 'wallet', creatorId: null },
        });

        const user = await User.findById(userId).select('walletBalance');
        res.status(200).json({ success: true, data: { walletBalance: Math.round(user?.walletBalance ?? 0) } });
    } catch (err) {
        next(err);
    }
}

// @desc  Get user's wallet transaction history
// @route GET /api/payment/wallet-transactions
// @access Private (user)
// BUG-14 FIX: Support pagination via page/limit query params
async function getWalletTransactions(req, res, next) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            PaymentModel.find({ userId: req.user._id, type: 'wallet', status: 'captured' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('amount cfOrderId createdAt status'),
            PaymentModel.countDocuments({ userId: req.user._id, type: 'wallet', status: 'captured' }),
        ]);

        res.status(200).json({
            success: true,
            data: transactions,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        next(err);
    }
}

// @desc  Get current user wallet balance
// @route GET /api/payment/wallet-balance
// @access Private (user)

async function getWalletBalance(req, res, next) {
    try {
        const user = await User.findById(req.user._id).select('walletBalance');
        res.status(200).json({ success: true, data: { walletBalance: Math.round(user?.walletBalance ?? 0) } });
    } catch (err) {
        next(err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /payment/status/:orderId
// Returns payment status + smart redirect destination for the frontend.
// Used when user refreshes /subscription-success, or to confirm payment state.
// ─────────────────────────────────────────────────────────────────────────────
async function getPaymentStatus(req, res, next) {
    try {
        const { orderId } = req.params;
        if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

        // 1. Check our DB first (fastest, authoritative after verify has run)
        const payment = await PaymentModel.findOne({ cfOrderId: orderId })
            .select('status type userId creatorId chatId amount')
            .populate('creatorId', 'username')
            .lean();

        if (payment) {
            // Only return data for the requesting user's own payments
            if (payment.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }

            const redirectTo = buildRedirect(payment);
            return res.json({ success: true, status: payment.status, type: payment.type, redirectTo });
        }

        // 2. Payment not found in DB yet — check Cashfree directly
        const cfOrder = await paymentService.getOrderStatus(orderId);
        const cfStatus = cfOrder.order_status; // PAID | ACTIVE | EXPIRED | CANCELLED

        if (cfStatus === 'PAID') {
            // Not verified yet — tell frontend to call /verify which will persist it
            return res.json({ success: true, status: 'pending_verify', type: 'unknown', redirectTo: null });
        }

        // Expired or cancelled
        return res.json({ success: true, status: 'failed', type: 'unknown', redirectTo: '/payment-failed' });

    } catch (err) {
        next(err);
    }
}

/** Build the correct redirect URL from a stored Payment document */
function buildRedirect(payment) {
    const type = payment.type;
    if (type === 'subscription') {
        const username = payment.creatorId?.username;
        return username ? `/creator/${username}` : '/';
    }
    if (type === 'wallet') return '/wallet';
    if (type === 'gift' || type === 'chat_unlock') {
        return payment.chatId ? `/chat/${payment.chatId}` : '/';
    }
    return '/';
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
    getWalletTransactions,
    getPaymentStatus,
};
