/**
 * One-time cleanup script — run on the server directly (no HTTP needed).
 * Removes duplicate Subscription docs and fixes totalSubscribers stats.
 *
 * Usage (from /root/Fannex/backend):
 *   node scripts/cleanupDuplicates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;
if (!MONGO_URI) {
    console.error('❌ No MONGO_URI or DATABASE_URL in .env');
    process.exit(1);
}

// ── Minimal inline schemas (no need to import full models) ────────────────────
const Subscription = mongoose.model('Subscription', new mongoose.Schema({
    userId:    mongoose.Schema.Types.ObjectId,
    creatorId: mongoose.Schema.Types.ObjectId,
    status:    String,
    expiresAt: Date,
    cfOrderId: String,
}, { timestamps: true }));

const CreatorProfile = mongoose.model('CreatorProfile', new mongoose.Schema({
    userId:           mongoose.Schema.Types.ObjectId,
    totalSubscribers: Number,
}, { strict: false }));

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ── Step 1: Remove duplicate Subscription docs ────────────────────────────
    console.log('🔧 Step 1: Finding and removing duplicate subscriptions...');

    const groups = await Subscription.aggregate([
        {
            $group: {
                _id:      { userId: '$userId', creatorId: '$creatorId' },
                count:    { $sum: 1 },
                ids:      { $push: '$_id' },
                latestId: { $last: '$_id' },
            },
        },
        { $match: { count: { $gt: 1 } } },
    ]);

    let deleted = 0;
    for (const group of groups) {
        const toDelete = group.ids.filter(
            (id) => id.toString() !== group.latestId.toString()
        );
        if (toDelete.length > 0) {
            const res = await Subscription.deleteMany({ _id: { $in: toDelete } });
            deleted += res.deletedCount;
            console.log(`  Removed ${res.deletedCount} dup(s) for userId=${group._id.userId}`);
        }
    }

    console.log(`✅ Step 1 done — ${groups.length} groups with dups, ${deleted} docs deleted\n`);

    // ── Step 2: Recalculate totalSubscribers from actual Subscription docs ────
    console.log('🔧 Step 2: Recalculating totalSubscribers for all creators...');

    const subCounts = await Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
    ]);

    const subMap = {};
    subCounts.forEach((s) => { subMap[s._id.toString()] = s.count; });

    const profiles = await CreatorProfile.find({}).select('_id userId').lean();
    const bulkOps = profiles.map((p) => ({
        updateOne: {
            filter: { _id: p._id },
            update: { $set: { totalSubscribers: subMap[p.userId?.toString()] ?? 0 } },
        },
    }));

    let updated = 0;
    if (bulkOps.length > 0) {
        const res = await CreatorProfile.bulkWrite(bulkOps);
        updated = res.modifiedCount;
    }

    console.log(`✅ Step 2 done — ${profiles.length} profiles checked, ${updated} updated\n`);

    console.log('🎉 All cleanup complete!');
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
});
