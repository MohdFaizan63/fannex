/**
 * MASTER RECONCILIATION SCRIPT
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the single source-of-truth correction script for the earnings system.
 *
 * PROBLEMS IT FIXES:
 *
 * 1. OLD chat_unlock / gift Payment docs used wrong base formula.
 *    - Old orders: fan paid chatPrice/giftPrice directly (NO GST charged).
 *      Correct formula: base = amount (the creator's price IS the base),
 *      creatorEarning = 80% of base.
 *    - Previous fix script wrongly used amount/1.18, giving base=₹0.847 instead of ₹1.
 *
 * 2. Earnings model (totalEarned, pendingAmount) was incremented by buggy code
 *    and is now OUT OF SYNC with the corrected Payment.creatorEarning values.
 *    Fix: Recompute totalEarned from Payment docs (the true source of truth).
 *    pendingAmount = totalEarned - withdrawnAmount (preserves payout history).
 *
 * 3. Subscription Payment docs may also have wrong baseAmount/creatorEarning
 *    if they were created before the GST fix and stored grossAmount as baseAmount.
 *
 * HOW TO RUN:
 *   node backend/scripts/masterReconcile.js
 *
 * SAFE TO RUN MULTIPLE TIMES (idempotent).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../src/models/Payment');
const Earnings = require('../src/models/Earnings');

// ── Business rules (must match gstHelper.js) ─────────────────────────────────
const CREATOR_RATE   = 0.80;   // 80% of base → creator
const PLATFORM_RATE  = 0.20;   // 20% of base → platform
const GST_RATE       = 0.18;   // 18% GST on fan payment
const R              = (n)   => Math.round(n * 100) / 100;

/**
 * Determine whether a Payment doc used NEW (post-GST-fix) logic or OLD logic.
 * NEW logic: fan paid base + 18% GST → amount ≈ base × 1.18
 * OLD logic: fan paid base directly → amount = base (no GST).
 *
 * Heuristic: if gstAmount > 0 in the doc, it was created with new logic.
 * Otherwise treat as old (base = amount, no GST charged).
 */
function isNewGSTOrder(doc) {
    return doc.gstAmount > 0;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Phase 1: Fix Payment docs ─────────────────────────────────────────────
    console.log('━━━ PHASE 1: Fix Payment docs ━━━\n');

    const payments = await Payment.find({
        status: 'captured',
        type: { $in: ['subscription', 'gift', 'chat_unlock'] },
    }).lean();

    console.log(`Found ${payments.length} captured payment(s) to examine.\n`);

    let fixedDocs = 0;

    for (const doc of payments) {
        const grossAmount = Number(doc.amount);   // what fan actually paid

        let expectedBase, expectedGST, expectedPlatformFee, expectedCreatorEarning;

        if (isNewGSTOrder(doc)) {
            // NEW order: fan paid base + 18% GST → base = amount / 1.18
            expectedBase           = R(grossAmount / 1.18);
            expectedGST            = R(grossAmount - expectedBase);
            expectedPlatformFee    = R(expectedBase * PLATFORM_RATE);
            expectedCreatorEarning = R(expectedBase * CREATOR_RATE);
        } else {
            // OLD order: fan paid chatPrice/price directly, no GST charged
            // base = the full amount paid (the creator's set price)
            expectedBase           = R(grossAmount);
            expectedGST            = 0;
            expectedPlatformFee    = R(expectedBase * PLATFORM_RATE);
            expectedCreatorEarning = R(expectedBase * CREATOR_RATE);
        }

        const currentEarning = Number(doc.creatorEarning || 0);
        const earningDiff    = Math.abs(currentEarning - expectedCreatorEarning);

        // Only update if there's a meaningful difference (>₹0.01)
        if (earningDiff > 0.01) {
            await Payment.findByIdAndUpdate(doc._id, {
                $set: {
                    baseAmount:      expectedBase,
                    gstAmount:       expectedGST,
                    platformFee:     expectedPlatformFee,
                    creatorEarning:  expectedCreatorEarning,
                },
            });
            console.log(
                `  FIXED [${doc.type}] ${doc._id} | paid=₹${grossAmount} | ` +
                `was=₹${currentEarning} → earning=₹${expectedCreatorEarning} ` +
                `(base=₹${expectedBase}, gst=₹${expectedGST})`
            );
            fixedDocs++;
        }
    }

    console.log(`\n✅ Phase 1 done — fixed ${fixedDocs} Payment doc(s).\n`);

    // ── Phase 2: Reconcile Earnings ledger ────────────────────────────────────
    console.log('━━━ PHASE 2: Reconcile Earnings ledger ━━━\n');

    // Group all captured Payment.creatorEarning by creatorId
    const totals = await Payment.aggregate([
        { $match: { status: 'captured', creatorId: { $exists: true, $ne: null } } },
        { $group: {
            _id:   '$creatorId',
            total: { $sum: '$creatorEarning' },
        }},
    ]);

    console.log(`Found ${totals.length} creator(s) with captured payments.\n`);

    let reconciledCount = 0;
    for (const { _id: creatorId, total } of totals) {
        const correctTotal = R(total);

        // Fetch existing Earnings doc (to preserve withdrawnAmount)
        const existing = await Earnings.findOne({ creatorId }).lean();
        const withdrawn = existing ? R(Number(existing.withdrawnAmount || 0)) : 0;

        // pendingAmount = what they haven't withdrawn yet
        const pendingAmount = R(Math.max(0, correctTotal - withdrawn));

        if (!existing) {
            // No Earnings doc yet — create it
            await Earnings.create({ creatorId, totalEarned: correctTotal, pendingAmount, withdrawnAmount: 0 });
            console.log(`  CREATED Earnings for creatorId=${creatorId} | total=₹${correctTotal} pending=₹${pendingAmount}`);
        } else {
            const prevTotal = R(existing.totalEarned);
            await Earnings.findOneAndUpdate(
                { creatorId },
                { $set: { totalEarned: correctTotal, pendingAmount } },
            );
            console.log(
                `  RECONCILED creatorId=${creatorId} | ` +
                `totalEarned: ₹${prevTotal} → ₹${correctTotal} | ` +
                `pending: ₹${R(existing.pendingAmount || 0)} → ₹${pendingAmount} | ` +
                `withdrawn: ₹${withdrawn}`
            );
        }
        reconciledCount++;
    }

    console.log(`\n✅ Phase 2 done — reconciled ${reconciledCount} creator Earnings ledger(s).\n`);
    console.log('🎉 Master reconciliation complete. All earnings are now correct.\n');
    process.exit(0);
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
