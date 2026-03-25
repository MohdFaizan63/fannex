/**
 * repairEarnings.js
 *
 * One-time repair script to bring the database in sync with the new
 * single-source-of-truth earnings architecture.
 *
 * What it fixes:
 *  1. Payment docs of type gift/chat_unlock/dream_fund with creatorEarning=0 or missing
 *     — backfills creatorEarning from giftAmount/amount using the standard GST formula.
 *  2. Earnings docs that have stale totalEarned or pendingAmount fields
 *     — resets them to 0 since they are no longer used (live-computed from Payment collection).
 *  3. Any Earnings docs whose withdrawnAmount > live totalEarned
 *     — caps withdrawnAmount to live totalEarned.
 *
 * Run ONCE after deploying the earnings refactor:
 *   node backend/scripts/repairEarnings.js
 *
 * Safe to run multiple times — all operations are idempotent.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const Earnings = require('../src/models/Earnings');
const PayoutRequest = require('../src/models/PayoutRequest');

const EARNING_TYPES = ['subscription', 'gift', 'chat_unlock', 'dream_fund'];
const R = (n) => Math.round((n || 0) * 100) / 100;

const PLATFORM_FEE = 0.20; // 20%
const GST_RATE = 0.18;     // 18%

// Recompute creatorEarning from a gross amount (base + GST)
function creatorEarningFromGross(gross) {
    const base = R(gross / (1 + GST_RATE));
    return R(base * (1 - PLATFORM_FEE));
}

// Recompute creatorEarning from a base amount (already excludes GST)
function creatorEarningFromBase(base) {
    return R(base * (1 - PLATFORM_FEE));
}

async function run() {
    console.log('[repairEarnings] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[repairEarnings] Connected.\n');

    // ─── Step 1: Fix Payment docs with creatorEarning=0 for non-subscription types ──
    console.log('[repairEarnings] Step 1: Fixing Payment docs with creatorEarning=0...');
    const brokenPayments = await Payment.find({
        type: { $in: ['gift', 'chat_unlock', 'dream_fund'] },
        status: 'captured',
        $or: [
            { creatorEarning: { $lte: 0 } },
            { creatorEarning: { $exists: false } },
        ],
    }).lean();

    console.log(`  Found ${brokenPayments.length} broken Payment docs.`);
    let fixedPayments = 0;

    for (const p of brokenPayments) {
        // Prefer baseAmount if available (already excludes GST)
        let earning;
        if (p.baseAmount && p.baseAmount > 0) {
            earning = creatorEarningFromBase(p.baseAmount);
        } else {
            const gross = p.giftAmount || p.amount || 0;
            if (!gross) {
                console.warn(`  [SKIP] Payment ${p._id} has no amount — skipping.`);
                continue;
            }
            earning = creatorEarningFromGross(gross);
        }

        const base = R((p.baseAmount && p.baseAmount > 0) ? p.baseAmount : (p.giftAmount || p.amount || 0) / (1 + GST_RATE));
        const gstAmount = R(base * GST_RATE);
        const platformFee = R(base * PLATFORM_FEE);

        await Payment.findByIdAndUpdate(p._id, {
            $set: {
                creatorEarning: earning,
                baseAmount: base,
                gstAmount,
                platformFee,
            },
        });
        fixedPayments++;
        console.log(`  Fixed Payment ${p._id} (${p.type}): creatorEarning=₹${earning}`);
    }
    console.log(`  ✅ Fixed ${fixedPayments} Payment docs.\n`);

    // ─── Step 2: Fix subscription Payment docs with creatorEarning=0 ─────────────
    console.log('[repairEarnings] Step 2: Fixing subscription Payment docs with creatorEarning=0...');
    const brokenSubs = await Payment.find({
        type: 'subscription',
        status: 'captured',
        $or: [
            { creatorEarning: { $lte: 0 } },
            { creatorEarning: { $exists: false } },
        ],
    }).lean();

    console.log(`  Found ${brokenSubs.length} broken subscription Payment docs.`);
    let fixedSubs = 0;

    for (const p of brokenSubs) {
        let base = p.baseAmount && p.baseAmount > 0 ? p.baseAmount : null;
        if (!base) {
            const gross = p.amount || 0;
            if (!gross) continue;
            base = R(gross / (1 + GST_RATE));
        }
        const earning = creatorEarningFromBase(base);
        const gstAmount = R(base * GST_RATE);
        const platformFee = R(base * PLATFORM_FEE);

        await Payment.findByIdAndUpdate(p._id, {
            $set: { creatorEarning: earning, baseAmount: base, gstAmount, platformFee },
        });
        fixedSubs++;
        console.log(`  Fixed sub Payment ${p._id}: creatorEarning=₹${earning}`);
    }
    console.log(`  ✅ Fixed ${fixedSubs} subscription Payment docs.\n`);

    // ─── Step 3: Reconcile Earnings docs — reset stale totalEarned/pendingAmount ─
    // These fields are no longer the source of truth. We zero them out so they
    // don't confuse any old code path that may still read them during transition.
    // withdrawnAmount is preserved — it IS still the source of truth.
    console.log('[repairEarnings] Step 3: Reconciling stale Earnings docs (zeroing totalEarned/pendingAmount)...');
    const updateResult = await Earnings.updateMany(
        { $or: [{ totalEarned: { $gt: 0 } }, { pendingAmount: { $gt: 0 } }] },
        { $set: { totalEarned: 0, pendingAmount: 0 } }
    );
    console.log(`  ✅ Reset stale totalEarned/pendingAmount on ${updateResult.modifiedCount} Earnings docs.\n`);

    // ─── Step 4: Cap withdrawnAmount to live totalEarned for each creator ─────────
    console.log('[repairEarnings] Step 4: Capping withdrawnAmount to live totalEarned...');
    const allEarnings = await Earnings.find({}).lean();
    let cappedCount = 0;

    for (const e of allEarnings) {
        const cid = e.creatorId;
        const [agg] = await Payment.aggregate([
            { $match: { creatorId: new mongoose.Types.ObjectId(String(cid)), status: 'captured', type: { $in: EARNING_TYPES } } },
            { $group: { _id: null, total: { $sum: '$creatorEarning' } } },
        ]);
        const liveTotalEarned = R(agg?.total ?? 0);
        if (e.withdrawnAmount > liveTotalEarned) {
            console.warn(`  [CAP] creatorId=${cid}: withdrawnAmount ₹${e.withdrawnAmount} > liveTotal ₹${liveTotalEarned} — capping.`);
            await Earnings.findByIdAndUpdate(e._id, { $set: { withdrawnAmount: liveTotalEarned } });
            cappedCount++;
        }
    }
    console.log(`  ✅ Capped withdrawnAmount on ${cappedCount} Earnings docs.\n`);

    // ─── Final summary ────────────────────────────────────────────────────────────
    console.log('════════════════════════════════════════════════');
    console.log('[repairEarnings] DONE');
    console.log(`  Payment docs fixed (non-sub):  ${fixedPayments}`);
    console.log(`  Payment docs fixed (sub):      ${fixedSubs}`);
    console.log(`  Earnings docs reset:           ${updateResult.modifiedCount}`);
    console.log(`  Earnings withdrawnAmount capped: ${cappedCount}`);
    console.log('════════════════════════════════════════════════');

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('[repairEarnings] FATAL:', err);
    process.exit(1);
});
