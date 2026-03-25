/**
 * dedupPayments.js — One-time repair script
 *
 * Finds and removes duplicate/orphan Payment documents that cause
 * incorrect earnings calculations.
 *
 * What it fixes:
 *  1. Payment docs with status='created' that were never captured
 *     (abandoned orders from createOrder). These sit in the DB as ghosts.
 *  2. Multiple Payment docs for the same Cashfree orderId (should never happen
 *     but can if race conditions hit). Keeps the one with sideEffectsDone=true.
 *  3. Reports on the actual live-computed earnings per creator after cleanup.
 *
 * Run ONCE:
 *   node backend/scripts/dedupPayments.js
 *
 * Safe to run multiple times — all ops are idempotent.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const Earnings = require('../src/models/Earnings');

const EARNING_TYPES = ['subscription', 'gift', 'chat_unlock', 'dream_fund'];
const R = (n) => Math.round((n || 0) * 100) / 100;

async function run() {
    console.log('[dedupPayments] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[dedupPayments] Connected.\n');

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 1: Remove orphan 'created' Payment docs (never captured)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[Step 1] Finding orphan Payment docs with status=created...');
    const orphans = await Payment.find({ status: 'created' }).lean();

    let orphanDeleted = 0;
    for (const p of orphans) {
        // Safety: only delete if a captured doc for the same cfOrderId exists,
        // OR if the doc is older than 1 hour (definitely abandoned)
        const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
        const hasCaptured = await Payment.exists({ cfOrderId: p.cfOrderId, status: 'captured' });

        if (hasCaptured || p.createdAt < ONE_HOUR_AGO) {
            await Payment.findByIdAndDelete(p._id);
            orphanDeleted++;
            console.log(`  [DEL] Orphan: _id=${p._id} cfOrderId=${p.cfOrderId} status=${p.status} age=${Math.round((Date.now() - p.createdAt) / 60000)}min`);
        }
    }
    console.log(`  ✅ Removed ${orphanDeleted} orphan Payment docs (of ${orphans.length} found)\n`);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 2: Find duplicate cfOrderIds among captured docs
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[Step 2] Finding duplicate cfOrderId groups among captured docs...');
    const dupGroups = await Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: '$cfOrderId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
    ]);

    let dupDeleted = 0;
    for (const group of dupGroups) {
        // Keep the doc that has sideEffectsDone=true, delete others
        const docs = await Payment.find({ _id: { $in: group.ids } })
            .sort({ sideEffectsDone: -1, createdAt: -1 }) // prefer sideEffectsDone=true, then newest
            .lean();

        const keep = docs[0];
        const toDelete = docs.slice(1);

        for (const d of toDelete) {
            await Payment.findByIdAndDelete(d._id);
            dupDeleted++;
            console.log(`  [DEL] Duplicate: _id=${d._id} cfOrderId=${d.cfOrderId} (keeping ${keep._id})`);
        }
    }
    console.log(`  ✅ Removed ${dupDeleted} duplicate captured docs (${dupGroups.length} groups)\n`);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 3: Report live earnings per creator
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('[Step 3] Computing live earnings per creator after cleanup...\n');

    const earningsByCreator = await Payment.aggregate([
        { $match: { status: 'captured', type: { $in: EARNING_TYPES } } },
        {
            $group: {
                _id: '$creatorId',
                totalEarned: { $sum: '$creatorEarning' },
                paymentCount: { $sum: 1 },
                types: { $addToSet: '$type' },
            },
        },
        { $sort: { totalEarned: -1 } },
    ]);

    console.log('  Creator ID                      | Payments | Total Earned | Types');
    console.log('  ─────────────────────────────────┼──────────┼──────────────┼──────────');
    for (const e of earningsByCreator) {
        const cid = e._id?.toString().padEnd(34) || 'null';
        console.log(`  ${cid}| ${String(e.paymentCount).padStart(8)} | ₹${R(e.totalEarned).toFixed(2).padStart(10)} | ${e.types.join(', ')}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 4: Sync Earnings.withdrawnAmount to not exceed live totalEarned
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[Step 4] Syncing Earnings docs...');
    const allEarnings = await Earnings.find({}).lean();
    let capped = 0;
    for (const e of allEarnings) {
        const [agg] = await Payment.aggregate([
            { $match: { creatorId: new mongoose.Types.ObjectId(String(e.creatorId)), status: 'captured', type: { $in: EARNING_TYPES } } },
            { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
        ]);
        const live = R(agg?.total ?? 0);
        const updates = {};
        if (e.withdrawnAmount > live) {
            updates.withdrawnAmount = live;
        }
        // Always zero out stale totalEarned/pendingAmount (these are now computed live)
        if (e.totalEarned > 0) updates.totalEarned = 0;
        if (e.pendingAmount > 0) updates.pendingAmount = 0;

        if (Object.keys(updates).length > 0) {
            await Earnings.findByIdAndUpdate(e._id, { $set: updates });
            capped++;
            console.log(`  [UPD] creatorId=${e.creatorId}: ${JSON.stringify(updates)}`);
        }
    }
    console.log(`  ✅ Synced ${capped} Earnings docs.\n`);

    console.log('════════════════════════════════════════════════');
    console.log('[dedupPayments] DONE');
    console.log(`  Orphan 'created' docs removed:     ${orphanDeleted}`);
    console.log(`  Duplicate captured docs removed:    ${dupDeleted}`);
    console.log(`  Earnings docs synced:               ${capped}`);
    console.log('════════════════════════════════════════════════');

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('[dedupPayments] FATAL:', err);
    process.exit(1);
});
