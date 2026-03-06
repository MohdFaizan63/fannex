const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const CreatorProfile = require('../models/CreatorProfile');
const { creditEarningsOnPayment } = require('./earningsService');

// Lazy-initialize Razorpay — only created when payment routes are actually called.
// This prevents startup crash when RAZORPAY_KEY_ID is a placeholder.
let _razorpay = null;
const getRazorpay = () => {
    if (!_razorpay) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        if (!keyId || keyId.includes('placeholder')) {
            throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env');
        }
        _razorpay = new Razorpay({ key_id: keyId, key_secret: process.env.RAZORPAY_KEY_SECRET });
    }
    return _razorpay;
};

/**
 * Create a Razorpay subscription plan + subscription for a creator
 */
const createSubscription = async ({ userId, creatorId, creatorProfile }) => {
    // 1. Create a Razorpay Plan (amount in paise: multiply INR by 100)
    const plan = await getRazorpay().plans.create({
        period: 'monthly',
        interval: 1,
        item: {
            name: `Subscription to Creator`,
            amount: creatorProfile.subscriptionPrice * 100, // paise
            currency: 'INR',
            description: `Monthly subscription`,
        },
    });

    // 2. Create Razorpay Subscription against the plan
    const razorpaySubscription = await getRazorpay().subscriptions.create({
        plan_id: plan.id,
        customer_notify: 1,
        total_count: 12, // 12 billing cycles
        notes: {
            userId: userId.toString(),
            creatorId: creatorId.toString(),
        },
    });

    return razorpaySubscription;
};

/**
 * Create a one-time Razorpay Order (for direct payments)
 */
const createOrder = async ({ amount, currency = 'INR', receipt, notes }) => {
    const order = await getRazorpay().orders.create({
        amount: amount * 100, // paise
        currency,
        receipt,
        notes,
    });
    return order;
};

/**
 * Verify Razorpay webhook signature
 */
const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

    return expectedSignature === signature;
};

/**
 * Verify Razorpay payment signature (client-side verification)
 */
const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return expectedSignature === razorpaySignature;
};

/**
 * Handle successful payment — store subscription & payment records,
 * then credit creator earnings inside a single Mongo transaction.
 */
const handlePaymentCaptured = async (payload) => {
    const { payment } = payload;
    const entity = payment.entity;

    const notes = entity.notes || {};
    const userId = notes.userId;
    const creatorId = notes.creatorId;

    if (!userId || !creatorId) return;

    // Calculate expiry (1 month from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const grossAmount = entity.amount / 100; // paise → INR

    // NOTE: We intentionally avoid Mongoose sessions/transactions here because
    // transactions require a MongoDB replica set. In development (standalone MongoDB)
    // any use of startTransaction causes a "Transaction numbers are only allowed
    // on a replica set member" crash. Using sequential writes is safe for dev
    // and can be upgraded to transactions later with a replica set.

    // 1. Store Payment record
    await Payment.create({
        userId,
        creatorId,
        amount: grossAmount,
        currency: entity.currency || 'INR',
        status: 'captured',
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        razorpaySubscriptionId: entity.subscription_id || null,
    });

    // 2. Upsert Subscription record
    await Subscription.findOneAndUpdate(
        { userId, creatorId },
        {
            userId,
            creatorId,
            status: 'active',
            expiresAt,
            stripeSubscriptionId: entity.subscription_id || null,
        },
        { upsert: true, returnDocument: 'after' }
    );

    // 3. Increment creator's totalSubscribers
    await CreatorProfile.findOneAndUpdate(
        { userId: creatorId },
        { $inc: { totalSubscribers: 1 } }
    );

    // 4. Credit creator earnings (80% after 20% platform fee)
    await creditEarningsOnPayment(creatorId, grossAmount, null);
};


/**
 * Handle subscription cancellation via Razorpay API
 */
const cancelSubscription = async ({ subscriptionId }) => {
    // Cancel at end of current billing cycle (cancel_at_cycle_end: 1)
    const cancelled = await getRazorpay().subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 1 });

    // Update DB record
    await Subscription.findOneAndUpdate(
        { razorpaySubscriptionId: subscriptionId },
        { status: 'canceled' }
    );

    // Decrement creator's totalSubscribers
    const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
    if (sub) {
        await CreatorProfile.findOneAndUpdate(
            { userId: sub.creatorId },
            { $inc: { totalSubscribers: -1 } }
        );
    }

    return cancelled;
};

module.exports = {
    createSubscription,
    createOrder,
    verifyWebhookSignature,
    verifyPaymentSignature,
    handlePaymentCaptured,
    cancelSubscription,
};
