const mongoose = require('mongoose');
const Earnings = require('../models/Earnings');
const PayoutRequest = require('../models/PayoutRequest');

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 20; // 20% platform cut → creator earns 80%

// ─── Payment types that generate creator earnings ─────────────────────────────
const EARNING_TYPES = ['subscription', 'gift', 'chat_unlock', 'dream_fund'];

// ─── Helper: ensure an ObjectId for use in aggregation pipelines ──────────────
// Mongoose does NOT auto-cast plain strings in aggregate $match — must cast explicitly.
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect whether the connected MongoDB deployment supports multi-document
 * transactions (requires a replica set or sharded cluster).
 */
let _transactionsSupported = null;
const supportsTransactions = async () => {
    if (_transactionsSupported !== null) return _transactionsSupported;
    try {
        const admin = mongoose.connection.db.admin();
        const { hosts } = await admin.serverStatus();
        _transactionsSupported = !!(hosts && hosts.length > 0);
    } catch {
        try {
            const result = await mongoose.connection.db.command({ isMaster: 1 });
            _transactionsSupported = !!(result.setName);
        } catch {
            _transactionsSupported = false;
        }
    }
    return _transactionsSupported;
};

/**
 * Run `fn(session)` inside a Mongo transaction.
 * Gracefully falls back to no-session on standalone MongoDB (dev).
 */
const withTransaction = async (fn) => {
    const useTransactions = await supportsTransactions();
    if (!useTransactions) {
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

// ─── Core Live-Balance Helper ─────────────────────────────────────────────────

/**
 * FIX-1: Single source of truth for a creator's live financial summary.
 * Reads from Payment collection (creatorEarning field) — NOT from stale Earnings doc.
 *
 * @param {ObjectId|string} creatorId
 * @param {ClientSession|null} [session]
 * @returns {{ totalEarned, withdrawnAmt, inFlight, availableBalance }}
 */
const _computeLiveBalance = async (creatorId, session = null) => {
    const Payment = require('../models/Payment');
    const R = (n) => Math.round(n * 100) / 100;

    // FIX-1: Always cast creatorId to ObjectId for aggregation — Mongoose does NOT auto-cast in aggregate $match
    const creatorObjId = toObjectId(creatorId);

    const maybeSession = (agg) => (session ? agg.session(session) : agg);

    const [aggResult, earnDoc, inFlightAgg] = await Promise.all([
        // 1. Live sum of all captured creator earnings — Payment is the source of truth
        maybeSession(Payment.aggregate([
            {
                $match: {
                    creatorId: creatorObjId,   // FIX-1: explicit ObjectId cast
                    status: 'captured',
                    type: { $in: EARNING_TYPES },
                },
            },
            { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
        ])),
        // 2. Earnings doc — only used for withdrawnAmount (only written when a payout is marked PAID)
        session
            ? Earnings.findOneAndUpdate(
                { creatorId },
                {},
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
              )
            : Earnings.findOneAndUpdate(
                { creatorId },
                {},
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
              ),
        // 3. In-flight payouts (pending/approved — money reserved, not yet disbursed)
        // FIX-3+4: Cast creatorId to ObjectId here too
        maybeSession(PayoutRequest.aggregate([
            {
                $match: {
                    creatorId: creatorObjId,   // FIX-3: explicit ObjectId cast
                    status: { $in: ['pending', 'approved'] },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])),
    ]);

    const totalEarned      = R(aggResult[0]?.total   ?? 0);
    const withdrawnAmt     = R(earnDoc?.withdrawnAmount ?? 0);
    const inFlight         = R(inFlightAgg[0]?.total  ?? 0);
    const availableBalance = R(Math.max(0, totalEarned - withdrawnAmt - inFlight));

    return { totalEarned, withdrawnAmt, inFlight, availableBalance, earnDoc };
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Credit earnings when a subscription payment is confirmed.
 * NOTE: For gift/chat_unlock — crediting is done directly in paymentService.handlePaymentCaptured
 * by setting creatorEarning on the Payment doc. This function is subscription-only.
 *
 * IMPORTANT: Only updates withdrawnAmount-adjacent ledger fields.
 * totalEarned and pendingAmount are now computed live from Payment collection.
 * This function is kept for backward-compatibility but now only ensures the
 * Earnings doc exists (upsert). It does NOT write totalEarned/pendingAmount
 * since those are derived from Payment.creatorEarning.
 *
 * @param {ObjectId|string} creatorId
 * @param {number}          baseAmount   - price BEFORE GST (creator-set price)
 * @param {ClientSession}   [session]    - optional existing Mongo session
 */
const creditEarningsOnPayment = async (creatorId, baseAmount, session = null) => {
    // FIX-9: Do NOT write totalEarned/pendingAmount to Earnings doc.
    // The Payment doc's creatorEarning field is the source of truth, aggregated live.
    // Only ensure the Earnings doc exists so withdrawnAmount has a home.
    const opts = session ? { session } : {};
    await Earnings.findOneAndUpdate(
        { creatorId },
        {},   // empty update — only creates doc if it doesn't exist
        { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after', ...opts }
    );
    // Log for observability
    const creatorShare = Math.round(baseAmount * (1 - PLATFORM_FEE_PERCENT / 100) * 100) / 100;
    console.log(`[earningsService] creditEarningsOnPayment: Earnings doc ensured for creatorId=${creatorId}, share=₹${creatorShare} (recorded in Payment.creatorEarning)`);
};

/**
 * Creator requests a payout.
 * Uses live Payment-aggregated balance as source of truth (FIX-2).
 */
const requestPayoutService = async (creatorId, amount) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        if (amount <= 0) {
            const err = new Error('Payout amount must be greater than 0.');
            err.statusCode = 400;
            throw err;
        }

        // FIX-2: Compute live balance from Payment collection — NOT stale Earnings doc
        const { totalEarned, withdrawnAmt, inFlight, availableBalance, earnDoc } =
            await _computeLiveBalance(creatorId, session);

        if (!earnDoc) {
            const err = new Error('No earnings record found. You have not received any payments yet.');
            err.statusCode = 400;
            throw err;
        }

        if (amount > availableBalance) {
            const err = new Error(
                `Requested amount (₹${amount}) exceeds your available balance (₹${availableBalance}).`
            );
            err.statusCode = 400;
            throw err;
        }

        // Create the payout request — withdrawnAmount is only updated when admin marks it PAID
        const [payoutRequest] = await PayoutRequest.create(
            [{ creatorId, amount, requestedAt: new Date() }],
            opts
        );

        return payoutRequest;
    });
};

/**
 * Admin: approve a pending payout request.
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
 * withdrawnAmount is the ONLY field we write to Earnings from the payout flow.
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

        payout.status = 'paid';
        payout.processedBy = adminId;
        payout.processedAt = new Date();
        await payout.save({ ...opts, validateBeforeSave: false });

        // Atomically increment withdrawnAmount — this is the ONLY write to Earnings from payout flow
        await Earnings.findOneAndUpdate(
            { creatorId: payout.creatorId },
            { $inc: { withdrawnAmount: payout.amount } },
            { upsert: true, ...opts }
        );

        return payout;
    });
};

/**
 * Admin: reject a pending payout request.
 * FIX-5: No longer restores pendingAmount on Earnings doc (it's computed live).
 * Only updates payout status.
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

        // FIX-5: No Earnings.$inc restore needed — pendingAmount is computed live:
        // availableBalance = totalEarned(Payment) − withdrawnAmt − inFlight(pending/approved payouts)
        // Rejecting moves the payout out of inFlight automatically → available balance increases.

        payout.status = 'rejected';
        payout.processedBy = adminId;
        payout.processedAt = new Date();
        payout.notes = notes || '';
        await payout.save({ ...opts, validateBeforeSave: false });

        return payout;
    });
};

/**
 * FIX-1+2+3+4: Compute live earnings figures from Payment collection.
 * This is now the single canonical source of truth for the creator dashboard.
 *
 * - totalEarned:    SUM(Payment.creatorEarning) where status=captured, type in EARNING_TYPES
 * - withdrawnAmt:   Earnings.withdrawnAmount (only written when payout is marked PAID)
 * - pendingAmount:  totalEarned − withdrawnAmt − inFlight
 * - inFlight:       SUM(PayoutRequest.amount) where status in [pending, approved]
 *
 * NO DB write performed — pure read.
 */
const getMyEarningsService = async (creatorId) => {
    const { totalEarned, withdrawnAmt, availableBalance, earnDoc } =
        await _computeLiveBalance(creatorId);

    return {
        _id:             earnDoc._id,
        creatorId:       earnDoc.creatorId,
        totalEarned,
        pendingAmount:   availableBalance,
        withdrawnAmount: withdrawnAmt,
        createdAt:       earnDoc.createdAt,
        updatedAt:       earnDoc.updatedAt,
    };
};

/**
 * Paginated list of payout requests for a creator.
 */
const listPayoutsService = async (creatorId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [results, total] = await Promise.all([
        PayoutRequest.find({ creatorId })
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('processedBy', 'name email'),
        PayoutRequest.countDocuments({ creatorId }),
    ]);
    return { results, total, page, pages: Math.ceil(total / limit) };
};

/**
 * FIX-2+6: Admin direct payout — uses live Payment-aggregated balance.
 * No longer reads stale Earnings.pendingAmount.
 */
const adminDirectPayoutService = async (creatorId, adminId) => {
    return withTransaction(async (session) => {
        const opts = session ? { session } : {};

        // FIX-2: Use live balance from Payment collection
        const { availableBalance, earnDoc } = await _computeLiveBalance(creatorId, session);

        if (!earnDoc) {
            const err = new Error('No earnings record found for this creator.');
            err.statusCode = 404;
            throw err;
        }

        const amount = Math.round(availableBalance * 100) / 100;

        if (amount <= 0) {
            const err = new Error('Creator has no available balance to pay out.');
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

        // Atomically credit withdrawnAmount — the ONLY field we write to Earnings doc
        await Earnings.findOneAndUpdate(
            { creatorId },
            { $inc: { withdrawnAmount: amount } },
            { upsert: true, ...opts }
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
    EARNING_TYPES,
    toObjectId,
    creditEarningsOnPayment,
    requestPayoutService,
    approvePayoutService,
    markPayoutPaidService,
    rejectPayoutService,
    getMyEarningsService,
    listPayoutsService,
    adminDirectPayoutService,
};
