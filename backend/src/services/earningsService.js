const mongoose = require('mongoose');
const Earnings = require('../models/Earnings');
const PayoutRequest = require('../models/PayoutRequest');

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 20; // 20% platform cut → creator earns 80%

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect whether the connected MongoDB deployment supports multi-document
 * transactions (requires a replica set or sharded cluster).
 * Standalone instances (common in local dev) do not support transactions.
 */
let _transactionsSupported = null; // cached after first check
const supportsTransactions = async () => {
    if (_transactionsSupported !== null) return _transactionsSupported;
    try {
        const admin = mongoose.connection.db.admin();
        const { hosts } = await admin.serverStatus();
        _transactionsSupported = !!(hosts && hosts.length > 0);
    } catch {
        // serverStatus may not report hosts on older versions; try isMaster
        try {
            const result = await mongoose.connection.db.command({ isMaster: 1 });
            _transactionsSupported = !!(result.setName); // replica set name present
        } catch {
            _transactionsSupported = false;
        }
    }
    return _transactionsSupported;
};

/**
 * Run `fn(session)` inside a Mongo transaction.
 * Gracefully falls back to no-session on standalone MongoDB (dev).
 *
 * @param {(session: ClientSession|null) => Promise<any>} fn
 */
const withTransaction = async (fn) => {
    const useTransactions = await supportsTransactions();

    if (!useTransactions) {
        // Standalone MongoDB — run without session (no ACID, but functional for dev)
        console.warn('[earningsService] Transactions not supported — running without session (dev mode).');
        return fn(null);
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const result = await fn(session);
        await session.commitTransaction();
        return result;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Credit earnings when a payment is confirmed.
 * Deducts the 20% platform fee and credits 80% of the BASE price to the creator.
 * GST (18%) is collected by the platform for tax compliance and is never included
 * in creator earnings.
 *
 * @param {ObjectId|string} creatorId
 * @param {number}          baseAmount   - price BEFORE GST (creator-set price)
 * @param {ClientSession}   [session]    - optional existing Mongo session
 */
const creditEarningsOnPayment = async (creatorId, baseAmount, session = null) => {
    // Creator earns 80% of base price — platform keeps 20% as fee
    const creatorShare = Math.round(baseAmount * (1 - PLATFORM_FEE_PERCENT / 100) * 100) / 100;

    const opts = session ? { session } : {};

    await Earnings.findOneAndUpdate(
        { creatorId },
        {
            $inc: {
                totalEarned: creatorShare,
                pendingAmount: creatorShare,
            },
        },
        { upsert: true, returnDocument: 'after', ...opts }
    );
};

/**
 * Creator requests a payout.
 * - Validates amount ≤ pendingAmount.
 * - Atomically decrements pendingAmount and creates a PayoutRequest.
 *
 * @param {ObjectId|string} creatorId
 * @param {number}          amount
 */
const requestPayoutService = async (creatorId, amount) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        // Fetch with session lock (or without, on standalone)
        const earnings = session
            ? await Earnings.findOne({ creatorId }).session(session)
            : await Earnings.findOne({ creatorId });

        if (!earnings) {
            const err = new Error('No earnings record found. You have not received any payments yet.');
            err.statusCode = 400;
            throw err;
        }

        if (amount <= 0) {
            const err = new Error('Payout amount must be greater than 0.');
            err.statusCode = 400;
            throw err;
        }

        if (amount > earnings.pendingAmount) {
            const err = new Error(
                `Requested amount (₹${amount}) exceeds your available balance (₹${earnings.pendingAmount}).`
            );
            err.statusCode = 400;
            throw err;
        }

        // Atomically decrement pendingAmount
        earnings.pendingAmount -= amount;
        await earnings.save({ ...opts, validateBeforeSave: false });

        // Create the payout request
        const [payoutRequest] = await PayoutRequest.create(
            [{ creatorId, amount, requestedAt: new Date() }],
            opts
        );

        return payoutRequest;
    });
};

/**
 * Admin: approve a pending payout request.
 *
 * @param {string} payoutId
 * @param {ObjectId|string} adminId
 */
const approvePayoutService = async (payoutId, adminId) => {
    const payout = await PayoutRequest.findById(payoutId);

    if (!payout) {
        const err = new Error('Payout request not found.');
        err.statusCode = 404;
        throw err;
    }

    if (payout.status !== 'pending') {
        const err = new Error(`Cannot approve a payout with status '${payout.status}'.`);
        err.statusCode = 400;
        throw err;
    }

    payout.status = 'approved';
    payout.processedBy = adminId;
    payout.processedAt = new Date();
    await payout.save({ validateBeforeSave: false });

    return payout;
};

/**
 * Admin: mark an approved payout as paid.
 * Increments withdrawnAmount on the creator's Earnings document atomically.
 *
 * @param {string} payoutId
 * @param {ObjectId|string} adminId
 */
const markPayoutPaidService = async (payoutId, adminId) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        const payout = session
            ? await PayoutRequest.findById(payoutId).session(session)
            : await PayoutRequest.findById(payoutId);

        if (!payout) {
            const err = new Error('Payout request not found.');
            err.statusCode = 404;
            throw err;
        }

        if (payout.status !== 'approved') {
            const err = new Error(`Cannot mark as paid — payout status is '${payout.status}'. It must be 'approved' first.`);
            err.statusCode = 400;
            throw err;
        }

        // Update payout status
        payout.status = 'paid';
        payout.processedBy = adminId;
        payout.processedAt = new Date();
        await payout.save({ ...opts, validateBeforeSave: false });

        // Atomically increment withdrawnAmount on earnings ledger
        await Earnings.findOneAndUpdate(
            { creatorId: payout.creatorId },
            { $inc: { withdrawnAmount: payout.amount } },
            opts
        );

        return payout;
    });
};

/**
 * Admin: reject a pending payout request and restore the creator's pendingAmount.
 *
 * @param {string} payoutId
 * @param {ObjectId|string} adminId
 * @param {string} notes - reason for rejection
 */
const rejectPayoutService = async (payoutId, adminId, notes) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        const payout = session
            ? await PayoutRequest.findById(payoutId).session(session)
            : await PayoutRequest.findById(payoutId);

        if (!payout) {
            const err = new Error('Payout request not found.');
            err.statusCode = 404;
            throw err;
        }

        if (payout.status !== 'pending') {
            const err = new Error(`Cannot reject a payout with status '${payout.status}'.`);
            err.statusCode = 400;
            throw err;
        }

        // Atomically restore pendingAmount to creator
        await Earnings.findOneAndUpdate(
            { creatorId: payout.creatorId },
            { $inc: { pendingAmount: payout.amount } },
            opts
        );

        payout.status = 'rejected';
        payout.processedBy = adminId;
        payout.processedAt = new Date();
        payout.notes = notes || '';
        await payout.save({ ...opts, validateBeforeSave: false });

        return payout;
    });
};

const getMyEarningsService = async (creatorId) => {
    const Payment      = require('../models/Payment');
    const PayoutRequest = require('../models/PayoutRequest');

    // ── Three parallel DB reads ───────────────────────────────────────────────
    const [aggResult, earnDoc, inFlightAgg] = await Promise.all([
        // 1. Live sum of all captured creator earnings (source of truth)
        Payment.aggregate([
            { $match: { creatorId, status: 'captured', type: { $in: ['subscription', 'gift', 'chat_unlock'] } } },
            { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
        ]),
        // 2. Earnings doc (for withdrawnAmount — incremented only when payout is marked PAID)
        Earnings.findOneAndUpdate(
            { creatorId },
            {},
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        ),
        // 3. Sum of all pending/approved payouts (money reserved, not yet disbursed)
        PayoutRequest.aggregate([
            { $match: { creatorId, status: { $in: ['pending', 'approved'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const R = (n) => Math.round(n * 100) / 100;

    const totalEarned    = R(aggResult[0]?.total ?? 0);
    const withdrawnAmt   = R(earnDoc.withdrawnAmount ?? 0);
    const inFlight       = R(inFlightAgg[0]?.total ?? 0);

    // Available = earned minus already withdrawn minus reserved-for-payout
    // This is what the creator can actually request RIGHT NOW
    const pendingAmount  = R(Math.max(0, totalEarned - withdrawnAmt - inFlight));

    // Write synced values back so requestPayoutService can use them for concurrency guard
    const synced = await Earnings.findOneAndUpdate(
        { creatorId },
        { $set: { totalEarned, pendingAmount } },
        { returnDocument: 'after' }
    );

    return synced;
};




/**
 * Paginated list of payout requests for a creator.
 *
 * @param {ObjectId|string} creatorId
 * @param {number} page
 * @param {number} limit
 */
const listPayoutsService = async (creatorId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
        PayoutRequest.find({ creatorId })
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('processedBy', 'name email'),
        PayoutRequest.countDocuments({ creatorId }),
    ]);

    return { payouts, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Admin: directly pay out a creator's full pending balance in one atomic step.
 * This bypasses the creator-request flow — useful for admin-initiated payouts.
 *
 * Flow:
 *  1. Validate pendingAmount > 0 (and no other pending/approved payout in-flight)
 *  2. Atomically decrement pendingAmount and increment withdrawnAmount
 *  3. Create a PayoutRequest doc with status='paid' immediately
 *
 * @param {string|ObjectId} creatorId
 * @param {string|ObjectId} adminId
 * @returns {Promise<PayoutRequest>}
 */
const adminDirectPayoutService = async (creatorId, adminId) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        // Lock the earnings doc (or fetch without lock on standalone)
        const earnings = session
            ? await Earnings.findOne({ creatorId }).session(session)
            : await Earnings.findOne({ creatorId });

        if (!earnings) {
            const err = new Error('No earnings record found for this creator.');
            err.statusCode = 404;
            throw err;
        }

        const amount = Math.round(earnings.pendingAmount * 100) / 100;

        if (amount <= 0) {
            const err = new Error('Creator has no pending balance to pay out.');
            err.statusCode = 400;
            throw err;
        }

        // Idempotency guard: reject if there is already an in-flight payout
        const inFlight = await PayoutRequest.findOne(
            { creatorId, status: { $in: ['pending', 'approved'] } },
            null,
            opts
        );
        if (inFlight) {
            const err = new Error(
                'A payout request is already pending or approved for this creator. Resolve it before initiating a new one.'
            );
            err.statusCode = 409;
            throw err;
        }

        // Atomically deduct pendingAmount and credit withdrawnAmount
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { pendingAmount: -amount, withdrawnAmount: amount } },
            opts
        );

        // Create a completed PayoutRequest record for audit trail
        const [payoutRequest] = await PayoutRequest.create(
            [{
                creatorId,
                amount,
                status: 'paid',
                processedBy: adminId,
                processedAt: new Date(),
                requestedAt: new Date(),
                notes: 'Admin direct payout',
            }],
            opts
        );

        return payoutRequest;
    });
};

module.exports = {
    PLATFORM_FEE_PERCENT,
    creditEarningsOnPayment,
    requestPayoutService,
    approvePayoutService,
    markPayoutPaidService,
    rejectPayoutService,
    getMyEarningsService,
    listPayoutsService,
    adminDirectPayoutService,
};
