/**
 * Final verification: checks that all chat_unlock earnings are >= 79% of amount,
 * and prints the breakdown for each creator.
 * Run: node backend/scripts/verifyEarnings.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../src/models/Payment');
const Earnings = require('../src/models/Earnings');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Check for any chat_unlock with earning < 79% of amount
    const wrong = await Payment.find({
        type: 'chat_unlock', status: 'captured',
        $expr: { $lt: ['$creatorEarning', { $multiply: ['$amount', 0.79] }] }
    }).lean();
    console.log(`Wrong chat_unlock records (earning < 79%): ${wrong.length} ${wrong.length === 0 ? '✅' : '❌'}`);
    wrong.forEach(d => console.log('  BAD:', d._id, 'amount=', d.amount, 'earning=', d.creatorEarning));

    // Breakdown by creator + type
    const agg = await Payment.aggregate([
        { $match: { status: 'captured', type: { $in: ['subscription','gift','chat_unlock'] } } },
        { $group: { _id: { creator: '$creatorId', type: '$type' }, total: { $sum: '$creatorEarning' } } },
    ]);

    const byCreator = {};
    agg.forEach(r => {
        const k = r._id.creator.toString();
        if (!byCreator[k]) byCreator[k] = { sub: 0, gift: 0, chat: 0 };
        const val = Math.round(r.total * 100) / 100;
        if (r._id.type === 'subscription') byCreator[k].sub = val;
        if (r._id.type === 'gift')         byCreator[k].gift = val;
        if (r._id.type === 'chat_unlock')  byCreator[k].chat = val;
    });

    console.log('\nCreator breakdown:');
    for (const [id, v] of Object.entries(byCreator)) {
        const total = Math.round((v.sub + v.gift + v.chat) * 100) / 100;
        console.log(`  ${id.slice(-6)}: sub=₹${v.sub} gift=₹${v.gift} chat=₹${v.chat} TOTAL=₹${total}`);
    }

    console.log('\nEarnings ledger:');
    const all = await Earnings.find().lean();
    all.forEach(e => {
        console.log(`  ${e.creatorId.toString().slice(-6)}: totalEarned=₹${e.totalEarned} pending=₹${e.pendingAmount} withdrawn=₹${e.withdrawnAmount}`);
    });

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
