/**
 * One-time fix: repair existing gift ChatMessages that saved giftAmount = total paid (e.g. 1.18)
 * instead of the base amount (e.g. 1.00).
 *
 * Logic: if a gift ChatMessage has giftAmount that does NOT match a "clean" base amount
 * (i.e. it looks like a GST-inclusive total), reverse the GST to find base and fix it.
 * "Looks like GST-inclusive" = the amount when divided by 1.18 gives a round-ish number.
 *
 * Run once:  node backend/scripts/fixGiftMessages.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const messages = db.collection('chatmessages');

    // Find gift messages — process all and correct any that stored total-paid amount
    const gifts = await messages.find({ type: 'gift', giftAmount: { $exists: true, $gt: 0 } }).toArray();
    console.log(`Found ${gifts.length} gift message(s) to check.`);

    let fixed = 0;
    for (const msg of gifts) {
        const ga = Number(msg.giftAmount);
        // Check if giftAmount looks like a GST-inclusive total:
        // base = ga/1.18 should be a "nicer" (more round) number
        const baseCandidate = Math.round(ga / 1.18 * 100) / 100;
        const reconstituted  = Math.round(baseCandidate * 1.18 * 100) / 100;

        // Only fix if rounding back matches — means it was GST-inclusive
        if (Math.abs(reconstituted - ga) < 0.01 && Math.abs(baseCandidate - ga) > 0.01) {
            await messages.updateOne(
                { _id: msg._id },
                { $set: { giftAmount: baseCandidate } }
            );
            console.log(`  Fixed message ${msg._id} | giftAmount: ${ga} → ${baseCandidate}`);
            fixed++;
        }
    }

    console.log(`\n✅ Done — fixed ${fixed} gift message(s).`);
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
