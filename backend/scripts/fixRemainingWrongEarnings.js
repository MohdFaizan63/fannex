/**
 * Fix remaining chat_unlock Payment docs where earning = full amount (100%, not 80%).
 * Run: node backend/scripts/fixRemainingWrongEarnings.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../src/models/Payment');
const Earnings = require('../src/models/Earnings');

const R = (n) => Math.round(n * 100) / 100;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected\n');

    // Find records where creatorEarning >= amount (creator got 100%+ — wrong)
    const bad = await Payment.find({
        status: 'captured',
        type: { $in: ['subscription', 'gift', 'chat_unlock'] },
        $expr: { $gte: ['$creatorEarning', '$amount'] },
    }).lean();

    console.log(`Found ${bad.length} wrong record(s)`);
    for (const doc of bad) {
        const base = R(doc.amount);  // old order: fan paid base directly, no GST
        const fix  = {
            baseAmount:     base,
            gstAmount:      0,
            platformFee:    R(base * 0.2),
            creatorEarning: R(base * 0.8),
        };
        await Payment.findByIdAndUpdate(doc._id, { $set: fix });
        console.log(`  FIXED ${doc._id} [${doc.type}] amount=₹${doc.amount} → earning=₹${fix.creatorEarning}`);
    }

    if (bad.length > 0) {
        console.log('\nReconciling Earnings ledgers...');
        const totals = await Payment.aggregate([
            { $match: { status: 'captured', creatorId: { $exists: true, $ne: null },
                        type: { $in: ['subscription', 'gift', 'chat_unlock'] } } },
            { $group: { _id: '$creatorId', total: { $sum: '$creatorEarning' } } },
        ]);
        for (const { _id: creatorId, total } of totals) {
            const correctTotal = R(total);
            const e = await Earnings.findOne({ creatorId }).lean();
            const withdrawn = R(e?.withdrawnAmount ?? 0);
            const pending   = R(Math.max(0, correctTotal - withdrawn));
            await Earnings.findOneAndUpdate(
                { creatorId },
                { $set: { totalEarned: correctTotal, pendingAmount: pending } },
                { upsert: true }
            );
            console.log(`  ${creatorId.toString().slice(-6)}: total=₹${correctTotal} pending=₹${pending}`);
        }
    }

    console.log('\n✅ Done');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
