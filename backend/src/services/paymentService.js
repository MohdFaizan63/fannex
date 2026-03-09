/**
 * Cashfree Payment Service
 * Replaces the previous Razorpay implementation.
 * Cashfree API v3 — REST-based: https://docs.cashfree.com/reference/overview
 */

const axios = require('axios');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const CreatorProfile = require('../models/CreatorProfile');
const { creditEarningsOnPayment } = require('./earningsService');

// ── Cashfree config ────────────────────────────────────────────────────────────
const CF_APP_ID = process.env.CASHFREE_APP_ID;
const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
const CF_ENV = (process.env.CASHFREE_ENV || 'production') === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';

// Shared request headers required by every Cashfree API call
const cfHeaders = () => ({
    'x-client-id': CF_APP_ID,
    'x-client-secret': CF_SECRET,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json',
});

// ── Create Payment Order ───────────────────────────────────────────────────────
/**
 * Creates a Cashfree payment order.
 * Returns { orderId, paymentSessionId, amount, currency } for the frontend.
 *
 * @param {Object} opts
 * @param {number}  opts.amount       Amount in INR (not paise)
 * @param {string}  opts.orderId      Unique order ID (max 50 chars)
 * @param {string}  opts.customerId   Fan/user ID (for Cashfree customer object)
 * @param {string}  opts.customerName Customer display name
 * @param {string}  opts.customerEmail
 * @param {string}  opts.customerPhone
 * @param {string}  opts.returnUrl    URL Cashfree redirects to after payment
 * @param {Object}  opts.meta         Free-form metadata stored in order tags
 */
const createOrder = async ({
    amount,
    orderId,
    customerId,
    customerName = 'Fannex User',
    customerEmail = 'user@fannex.in',
    customerPhone = '9000000000',
    returnUrl,
    meta = {},
}) => {
    if (!CF_APP_ID || !CF_SECRET) {
        throw new Error('Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env');
    }

    // CLIENT_URL may contain comma-separated values (e.g. for local dev); pick the first one
    const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim();
    const apiUrl = (process.env.API_URL || '').trim();

    const body = {
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
            customer_id: customerId,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
        },
        order_meta: {
            return_url: returnUrl || `${clientUrl}/subscription-success?order_id={order_id}`,
            ...(apiUrl ? { notify_url: `${apiUrl}/api/v1/payment/webhook` } : {}),
        },
        order_tags: meta,
    };

    try {
        const { data } = await axios.post(
            `${CF_ENV}/pg/orders`,
            body,
            { headers: cfHeaders() }
        );

        // data.payment_session_id → used by Cashfree.js on the frontend
        return {
            orderId: data.order_id,
            paymentSessionId: data.payment_session_id,
            amount: data.order_amount,
            currency: data.order_currency,
            status: data.order_status,
        };
    } catch (err) {
        // Log the full Cashfree error response for debugging
        if (err.response) {
            console.error('[Cashfree createOrder] Status:', err.response.status);
            console.error('[Cashfree createOrder] Response:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('[Cashfree createOrder] Error:', err.message);
        }
        throw err;
    }
};

// ── Fetch Order Status ─────────────────────────────────────────────────────────
const getOrderStatus = async (orderId) => {
    const { data } = await axios.get(
        `${CF_ENV}/pg/orders/${orderId}`,
        { headers: cfHeaders() }
    );
    return data; // { order_status: 'PAID'|'ACTIVE'|'EXPIRED'|'CANCELLED', ... }
};

// ── Fetch Payments for an Order ───────────────────────────────────────────────
const getOrderPayments = async (orderId) => {
    const { data } = await axios.get(
        `${CF_ENV}/pg/orders/${orderId}/payments`,
        { headers: cfHeaders() }
    );
    return data; // array of payment objects
};

// ── Verify Webhook Signature ───────────────────────────────────────────────────
/**
 * Cashfree webhook signature verification.
 * Signature = HMAC-SHA256( timestamp + rawBody, secretKey ) encoded as base64
 */
const verifyWebhookSignature = (rawBody, signature, timestamp) => {
    const payload = timestamp + rawBody;
    const expectedSig = crypto
        .createHmac('sha256', CF_SECRET)
        .update(payload)
        .digest('base64');
    return expectedSig === signature;
};

// ── Handle Successful Payment ─────────────────────────────────────────────────
/**
 * Called after verifying a webhook (event: PAYMENT_SUCCESS_WEBHOOK)
 * or after client-side order status check confirms PAID.
 */
const handlePaymentCaptured = async ({ orderId, cfPaymentId, amount, meta }) => {
    const { userId, creatorId, type = 'subscription' } = meta;

    if (!userId) return;

    const grossAmount = Number(amount);

    // Wallet top-ups — idempotent: only credit if not already captured
    if (type === 'wallet') {
        const User = require('../models/User');

        // Check if this order was already captured — prevents double credit on re-verify
        const existingPayment = await Payment.findOne({ cfOrderId: orderId });
        const alreadyCaptured = existingPayment?.status === 'captured';

        // Always upsert the Payment record (idempotency key)
        await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            {
                userId,
                amount: grossAmount,
                currency: 'INR',
                type: 'wallet',
                status: 'captured',
                cfOrderId: orderId,
                cfPaymentId: cfPaymentId || null,
            },
            { upsert: true }
        );

        // Only credit walletBalance on first capture
        if (!alreadyCaptured) {
            await User.findByIdAndUpdate(
                userId,
                { $inc: { walletBalance: grossAmount } }
            );
        }
        return;
    }


    // For all other types (subscription, gift, chat_unlock), creatorId is required
    if (!creatorId) return;

    // 1. Store/update Payment record (may already exist from order creation step)
    await Payment.findOneAndUpdate(
        { cfOrderId: orderId },
        {
            userId,
            creatorId,
            amount: grossAmount,
            currency: 'INR',
            type,
            status: 'captured',
            cfOrderId: orderId,
            cfPaymentId,
        },
        { upsert: true }
    );

    if (type === 'subscription') {
        // 2. Upsert Subscription record (active for 1 month)
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await Subscription.findOneAndUpdate(
            { userId, creatorId },
            { userId, creatorId, status: 'active', expiresAt, cfOrderId: orderId },
            { upsert: true, returnDocument: 'after' }
        );

        // 3. Increment creator's totalSubscribers
        await CreatorProfile.findOneAndUpdate(
            { userId: creatorId },
            { $inc: { totalSubscribers: 1 } }
        );

        // 4. Auto-create / unlock chat room so subscriber can chat immediately
        const ChatRoom = require('../models/ChatRoom');
        await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, unlockedAt: new Date() },
            { upsert: true }
        );

        // 5. Credit creator earnings (80% after 20% platform fee)
        await creditEarningsOnPayment(creatorId, grossAmount, null);

    } else if (type === 'gift') {
        // Credit 90% to creator for gifts
        const Earnings = require('../models/Earnings');
        const creatorCut = Math.floor(grossAmount * 0.9);
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: creatorCut, pendingAmount: creatorCut } },
            { upsert: true, new: true }
        );

    } else if (type === 'chat_unlock') {
        // Create/unlock chat room and credit creator
        const ChatRoom = require('../models/ChatRoom');
        const Earnings = require('../models/Earnings');

        const room = await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, chatPaymentId: cfPaymentId, unlockedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );

        // Credit full amount to creator for chat unlocks
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: grossAmount, pendingAmount: grossAmount } },
            { upsert: true }
        );

    } else if (type === 'wallet') {
        const User = require('../models/User');
        await User.findByIdAndUpdate(
            userId,
            { $inc: { walletBalance: grossAmount } }
        );
    }
};

// ── Cancel Subscription ───────────────────────────────────────────────────────
/**
 * Cashfree does not have a native "recurring subscription" object like Razorpay.
 * Cancellation = mark the DB subscription as cancelled; the user won't be charged
 * again because there's no auto-renewal order on our end.
 */
const cancelSubscription = async ({ subscriptionId }) => {
    const sub = await Subscription.findByIdAndUpdate(
        subscriptionId,
        { status: 'canceled' },
        { new: true }
    );

    if (sub) {
        await CreatorProfile.findOneAndUpdate(
            { userId: sub.creatorId },
            { $inc: { totalSubscribers: -1 } }
        );
    }

    return sub;
};

module.exports = {
    createOrder,
    getOrderStatus,
    getOrderPayments,
    verifyWebhookSignature,
    handlePaymentCaptured,
    cancelSubscription,
};
