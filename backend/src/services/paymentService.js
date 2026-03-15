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
const { calcGST } = require('../utils/gstHelper');

// ── Cashfree config ────────────────────────────────────────────────────────────
const CF_APP_ID = process.env.CASHFREE_APP_ID;
const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
const CF_ENV_NAME = process.env.CASHFREE_ENV || 'production'; // 'sandbox' or 'production'
const CF_ENV = CF_ENV_NAME === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';

// Shared request headers required by every Cashfree API call
const cfHeaders = () => ({
    'x-client-id': CF_APP_ID,
    'x-client-secret': CF_SECRET,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json',
});

/**
 * Safe upstream status mapper — prevents Cashfree's 401/403 from reaching
 * the frontend and triggering the global logout interceptor in api.js.
 * Maps:
 *   401 → 502  (invalid CF credentials, not a Fannex auth error)
 *   403 → 502
 *   everything else → as-is (but min 400)
 */
const safeCfStatus = (upstreamStatus) => {
    if (upstreamStatus === 401 || upstreamStatus === 403) return 502;
    return upstreamStatus >= 400 ? upstreamStatus : 500;
};

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
            cancel_url: `${clientUrl}/payment-failed`,
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
            cfMode: CF_ENV_NAME,  // 'sandbox' or 'production' — frontend must use the same mode
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
 *
 * Webhook version 2022-09-01 / 2023-08-01 format:
 *   HMAC-SHA256( timestamp + rawBody, secretKey ) → base64
 *
 * Webhook version 2025-01-01 format:
 *   HMAC-SHA256( timestamp + "." + rawBody, secretKey ) → base64
 *
 * We try both so it works regardless of which version is set in the dashboard.
 */
const verifyWebhookSignature = (rawBody, signature, timestamp) => {
    if (!rawBody || !signature || !timestamp || !CF_SECRET) return false;

    const tryVerify = (payload) => {
        const expectedSig = crypto
            .createHmac('sha256', CF_SECRET)
            .update(payload)
            .digest('base64');
        return expectedSig === signature;
    };

    // Try new format (2025-01-01): timestamp + "." + rawBody
    if (tryVerify(timestamp + '.' + rawBody)) return true;
    // Try old format (2023-08-01): timestamp + rawBody
    if (tryVerify(timestamp + rawBody)) return true;

    return false;
};

// ── Handle Successful Payment ─────────────────────────────────────────────────
/**
 * Called after verifying a webhook (event: PAYMENT_SUCCESS_WEBHOOK)
 * or after client-side order status check confirms PAID.
 */
const handlePaymentCaptured = async ({ orderId, cfPaymentId, amount, meta }) => {
    const { userId, creatorId, type = 'subscription', baseAmount: metaBase } = meta;

    if (!userId) return;

    const grossAmount = Number(amount);  // total fan paid (base + GST)

    // ── Wallet top-ups: NO GST (fan depositing own money, not buying content) ──
    if (type === 'wallet') {
        const User = require('../models/User');

        const result = await Payment.findOneAndUpdate(
            { cfOrderId: orderId, status: { $ne: 'captured' } },
            {
                $set: {
                    userId,
                    amount: grossAmount,
                    baseAmount: grossAmount,  // wallet: base = gross (no GST)
                    gstAmount: 0,
                    platformFee: 0,
                    creatorEarning: 0,
                    currency: 'INR',
                    type: 'wallet',
                    status: 'captured',
                    cfOrderId: orderId,
                    cfPaymentId: cfPaymentId || null,
                },
            },
            { upsert: false, returnDocument: 'before' }
        );

        if (!result) {
            const existed = await Payment.findOne({ cfOrderId: orderId, status: 'captured' });
            if (!existed) {
                await Payment.create({
                    userId,
                    amount: grossAmount,
                    baseAmount: grossAmount,
                    gstAmount: 0,
                    platformFee: 0,
                    creatorEarning: 0,
                    currency: 'INR',
                    type: 'wallet',
                    status: 'captured',
                    cfOrderId: orderId,
                    cfPaymentId: cfPaymentId || null,
                }).catch(() => { });

                const justCreated = await Payment.findOne({ cfOrderId: orderId, status: 'captured' });
                if (justCreated && justCreated.cfPaymentId === (cfPaymentId || null)) {
                    await User.findByIdAndUpdate(userId, { $inc: { walletBalance: grossAmount } });
                }
            }
        } else {
            await User.findByIdAndUpdate(userId, { $inc: { walletBalance: grossAmount } });
        }
        return;
    }

    // ── All paid-content types: GST breakdown ───────────────────────────────────
    if (!creatorId) return;

    // Derive GST breakdown:
    // metaBase is stored when the order is created; fall back to reverse-calculating
    // base from grossAmount in case old orders don't have it in meta.
    const base = metaBase ? Number(metaBase) : Math.round(grossAmount / 1.18 * 100) / 100;
    const gst = calcGST(base);

    // 1. Upsert Payment record with full GST breakdown
    await Payment.findOneAndUpdate(
        { cfOrderId: orderId },
        {
            $set: {
                userId,
                creatorId,
                amount: grossAmount,          // total fan paid
                baseAmount:     gst.baseAmount,
                gstAmount:      gst.gstAmount,
                platformFee:    gst.platformFee,
                creatorEarning: gst.creatorEarning,
                currency: 'INR',
                type,
                status: 'captured',
                cfOrderId: orderId,
                cfPaymentId,
            },
        },
        { upsert: true }
    );

    if (type === 'subscription') {
        // 2. Activate subscription (1 month)
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await Subscription.findOneAndUpdate(
            { userId, creatorId },
            { userId, creatorId, status: 'active', expiresAt, cfOrderId: orderId },
            { upsert: true, returnDocument: 'after' }
        );

        // 3. Increment creator subscriber count
        await CreatorProfile.findOneAndUpdate(
            { userId: creatorId },
            { $inc: { totalSubscribers: 1 } }
        );

        // 4. Auto-unlock chat room for subscriber
        const ChatRoom = require('../models/ChatRoom');
        await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, unlockedAt: new Date() },
            { upsert: true }
        );

        // 5. Credit creator earnings — 80% of BASE only (no GST)
        await creditEarningsOnPayment(creatorId, gst.baseAmount, null);

    } else if (type === 'gift') {
        // Gift: creator earns 80% of base (GST excluded)
        const Earnings = require('../models/Earnings');
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: gst.creatorEarning, pendingAmount: gst.creatorEarning } },
            { upsert: true }
        );

    } else if (type === 'chat_unlock') {
        // Chat unlock: unlock room + credit 80% of base to creator
        const ChatRoom = require('../models/ChatRoom');
        const Earnings = require('../models/Earnings');

        await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, chatPaymentId: cfPaymentId, unlockedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );

        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: gst.creatorEarning, pendingAmount: gst.creatorEarning } },
            { upsert: true }
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
    safeCfStatus,
};
