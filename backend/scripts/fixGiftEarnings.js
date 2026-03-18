/**
 * One-time fix: backfill correct creatorEarning on gift Payment docs that have
 * creatorEarning = 0 because they were pre-created by chatController.createGiftOrder
 * before the fix was deployed.
 *
 * Run once:  node backend/scripts/fixGiftEarnings.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../src/models/Payment');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all captured gift payments where creatorEarning is 0 but amount > 0
    const bad = await Payment.find({
        type: 'gift',
        status: 'captured',
        amount: { $gt: 0 },
        creatorEarning: { $lte: 0 },
    }).lean();

    console.log(`Found ${bad.length} gift Payment doc(s) with creatorEarning = 0 to fix.`);

    let fixed = 0;
    for (const doc of bad) {
        const grossAmount = Number(doc.amount);
        const base           = Math.round(grossAmount / 1.18 * 100) / 100;
        const creatorEarning = Math.round(base * 0.8 * 100) / 100;
        const platformFee    = Math.round(base * 0.2 * 100) / 100;
        const gstAmount      = Math.round((grossAmount - base) * 100) / 100;

        await Payment.findByIdAndUpdate(doc._id, {
            $set: { baseAmount: base, gstAmount, platformFee, creatorEarning },
        });

        console.log(`  Fixed payment ${doc._id} | amount=₹${grossAmount} → creatorEarning=₹${creatorEarning}`);
        fixed++;
    }

    console.log(`\n✅ Done — fixed ${fixed} document(s).`);
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
