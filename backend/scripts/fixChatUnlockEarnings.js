/**
 * One-time fix: backfill correct creatorEarning on chat_unlock Payment docs.
 * These were created before the GST + 80/20 fix. They stored amount=chatPrice (no GST),
 * and either creatorEarning=0 (default) or creatorEarning=chatPrice (wrong — 100% not 80%).
 *
 * Correct formula for old orders (no GST):
 *   base         = old amount (chatPrice, was already base, no GST charged)
 *   creatorEarning = 0.80 × base
 *   platformFee    = 0.20 × base
 *   gstAmount      = 0 (GST was not charged on old orders)
 *
 * Run once: node backend/scripts/fixChatUnlockEarnings.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../src/models/Payment');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find chat_unlock payments that are captured but have wrong creatorEarning
    const bad = await Payment.find({
        type: 'chat_unlock',
        status: 'captured',
        amount: { $gt: 0 },
        $or: [
            { creatorEarning: { $lte: 0 } },               // zero/missing
            { $expr: { $gte: ['$creatorEarning', '$amount'] } }, // full amount (no platform cut)
        ],
    }).lean();

    console.log(`Found ${bad.length} chat_unlock Payment doc(s) to fix.`);

    let fixed = 0;
    for (const doc of bad) {
        const totalPaid = Number(doc.amount);

        // For old orders, amount = chatPrice (base, no GST was charged)
        // Correct earnings = 80% of base
        const base          = Math.round(totalPaid / 1.18 * 100) / 100;
        const creatorEarning = Math.round(base * 0.8 * 100) / 100;
        const platformFee    = Math.round(base * 0.2 * 100) / 100;
        const gstAmount      = Math.round((totalPaid - base) * 100) / 100;

        await Payment.findByIdAndUpdate(doc._id, {
            $set: { baseAmount: base, gstAmount, platformFee, creatorEarning },
        });

        console.log(`  Fixed payment ${doc._id} | amount=₹${totalPaid} → base=₹${base}, creatorEarning=₹${creatorEarning}`);
        fixed++;
    }

    console.log(`\n✅ Done — fixed ${fixed} chat_unlock Payment doc(s).`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
