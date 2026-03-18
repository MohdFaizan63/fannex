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

// BUG 3 FIX: Warn loudly at startup if CASHFREE_ENV is not explicitly set.
// A missing env var silently defaults to 'production', which makes sandbox
// paymentSessionIds get rejected by the production SDK (and vice versa).
if (!process.env.CASHFREE_ENV) {
    console.warn('[paymentService] WARNING: CASHFREE_ENV is not set in .env — defaulting to "production". Set CASHFREE_ENV=sandbox for testing.');
}
if (!CF_APP_ID || !CF_SECRET) {
    console.warn('[paymentService] WARNING: CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing. Payments will fail.');
}

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
 * Idempotent handler for captured payments.
 *
 * Called by BOTH:
 *   - POST /payment/verify  (frontend, after Cashfree redirect)
 *   - POST /payment/webhook (Cashfree server, PAYMENT_SUCCESS_WEBHOOK)
 *
 * Idempotency guarantee:
 *   We use a `sideEffectsDone` boolean on the Payment document.
 *   Only the first caller that atomically sets sideEffectsDone=false→true
 *   will run subscriber count / earnings increments.
 *   All subsequent callers find sideEffectsDone=true and return immediately.
 *   This prevents double-counting even if webhook and verify race each other.
 */
const handlePaymentCaptured = async ({ orderId, cfPaymentId, amount, meta }) => {
    const { userId, creatorId, type = 'subscription', baseAmount: metaBase } = meta;

    if (!userId) return;

    const grossAmount = Number(amount);  // total fan paid (base + GST)

    // ── Wallet top-ups: WITH GST (fan pays base+18%, wallet credits base only) ──
    if (type === 'wallet') {
        const User = require('../models/User');

        // Amount to credit to wallet = base amount ONLY (excluding GST)
        // Read from order meta (set by createWalletOrder after GST fix).
        // Fall back to grossAmount for old orders that didn't store baseAmount.
        const { baseAmount: metaBaseWallet } = meta;
        const walletCredit = metaBaseWallet
            ? Number(metaBaseWallet)
            : grossAmount; // backward compat: old orders had no GST, so grossAmount = base

        const walletGst    = Math.round((grossAmount - walletCredit) * 100) / 100;
        const walletPlatform = 0; // wallet top-ups have no platform split

        // STEP 1: Ensure Payment doc exists
        await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            {
                $setOnInsert: {
                    userId,
                    amount: grossAmount,          // total fan paid (base + GST)
                    baseAmount: walletCredit,     // base (goes to wallet)
                    gstAmount: walletGst,         // 18% GST (tracked separately)
                    platformFee: walletPlatform,
                    creatorEarning: 0,
                    currency: 'INR',
                    type: 'wallet',
                    status: 'created',
                    cfOrderId: orderId,
                    sideEffectsDone: false,
                },
            },
            { upsert: true }
        );

        // STEP 2: Atomically claim the "credit" slot
        const claimed = await Payment.findOneAndUpdate(
            { cfOrderId: orderId, sideEffectsDone: false },
            {
                $set: {
                    status: 'captured',
                    cfPaymentId: cfPaymentId || null,
                    sideEffectsDone: true,
                    baseAmount: walletCredit,
                    gstAmount: walletGst,
                },
            },
            { new: false }
        );

        if (claimed) {
            // Credit only BASE amount to wallet — GST goes to government, not fan's balance
            await User.findByIdAndUpdate(userId, { $inc: { walletBalance: walletCredit } });
            console.log(`[handlePaymentCaptured] ✅ Wallet credited userId=${userId} base=₹${walletCredit} (fan paid ₹${grossAmount} incl. GST)`);
        } else {
            console.log(`[handlePaymentCaptured] ℹ️ Wallet already credited, skipping orderId=${orderId}`);
        }
        return;
    }


    // ── All paid-content types: GST breakdown ─────────────────────────────────
    if (!creatorId) return;

    const base = metaBase ? Number(metaBase) : Math.round(grossAmount / 1.18 * 100) / 100;
    const gst = calcGST(base);

    // ──────────────────────────────────────────────────────────────────────────
    // BULLETPROOF IDEMPOTENCY PATTERN
    //
    // Step 1: Try to INSERT a new Payment doc with sideEffectsDone=false.
    //         If one already exists for this orderId, this is a no-op.
    // Step 2: Atomically flip sideEffectsDone false→true.
    //         Only ONE caller will see the "before" doc with false.
    //         All other callers (webhook retry, verify retry) see true → skip.
    // ──────────────────────────────────────────────────────────────────────────

    // Step 1: Ensure Payment doc exists (upsert-safe, no rawResult needed)
    await Payment.findOneAndUpdate(
        { cfOrderId: orderId },
        {
            $setOnInsert: {
                userId,
                creatorId,
                amount: grossAmount,
                baseAmount: gst.baseAmount,
                gstAmount: gst.gstAmount,
                platformFee: gst.platformFee,
                creatorEarning: gst.creatorEarning,
                currency: 'INR',
                type,
                status: 'captured',
                cfOrderId: orderId,
                cfPaymentId,
                sideEffectsDone: false,  // ← key flag
            },
        },
        { upsert: true }   // NO rawResult — simple upsert
    );

    // Step 2: Atomically claim the right to run side effects exactly once
    // findOneAndUpdate returns the BEFORE doc. If sideEffectsDone was false → we own it.
    // If it was already true → someone else already ran side effects → skip.
    const claimed = await Payment.findOneAndUpdate(
        { cfOrderId: orderId, sideEffectsDone: false },
        { $set: { sideEffectsDone: true, status: 'captured' } },
        { new: false }  // return BEFORE doc so we know if we won the claim
    );

    if (!claimed) {
        // sideEffectsDone was already true → side effects already ran → idempotent exit
        console.log(`[handlePaymentCaptured] Side effects already done, skipping orderId=${orderId}`);
        return;
    }

    console.log(`[handlePaymentCaptured] Running side effects for orderId=${orderId} type=${type}`);

    // ── Side effects run exactly once for this orderId ────────────────────────

    if (type === 'subscription') {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        // Check if subscriber existed BEFORE this payment
        const existingSub = await Subscription.findOne({ userId, creatorId }).select('_id').lean();
        const isNewSubscriber = !existingSub;

        await Subscription.findOneAndUpdate(
            { userId, creatorId },
            { userId, creatorId, status: 'active', expiresAt, cfOrderId: orderId },
            { upsert: true }
        );

        if (isNewSubscriber) {
            await CreatorProfile.findOneAndUpdate(
                { userId: creatorId },
                { $inc: { totalSubscribers: 1 } }
            );
            console.log(`[handlePaymentCaptured] New subscriber counted creatorId=${creatorId}`);
        }

        // Unlock chat room
        const ChatRoom = require('../models/ChatRoom');
        await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, unlockedAt: new Date() },
            { upsert: true }
        );

        // Credit 80% of BASE to creator earnings (runs ONCE thanks to the claim above)
        await creditEarningsOnPayment(creatorId, gst.baseAmount, null);
        console.log(`[handlePaymentCaptured] Earnings credited creatorId=${creatorId} amount=${gst.baseAmount}`);

    } else if (type === 'gift') {
        const Earnings = require('../models/Earnings');

        // ALWAYS update Payment doc with correct GST split — the doc may have been
        // pre-created by chatController.createGiftOrder with creatorEarning=0 (default).
        // $setOnInsert above was a no-op in that case, so we must $set it explicitly.
        await Payment.findOneAndUpdate(
            { cfOrderId: orderId },
            { $set: {
                giftAmount: grossAmount,
                baseAmount: gst.baseAmount,
                gstAmount: gst.gstAmount,
                platformFee: gst.platformFee,
                creatorEarning: gst.creatorEarning,
            }},
            { upsert: false }
        );

        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { totalEarned: gst.creatorEarning, pendingAmount: gst.creatorEarning } },
            { upsert: true }
        );

    } else if (type === 'chat_unlock') {
        const ChatRoom = require('../models/ChatRoom');
        const Earnings = require('../models/Earnings');

        await ChatRoom.findOneAndUpdate(
            { creatorId, userId },
            { isPaid: true, chatPaymentId: cfPaymentId, unlockedAt: new Date() },
            { upsert: true }
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
