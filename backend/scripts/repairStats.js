/**
 * repairStats.js
 * One-time script to recalculate totalPosts and totalSubscribers
 * for all CreatorProfiles from the actual source-of-truth collections.
 *
 * Run from the backend directory:
 *   node scripts/repairStats.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DB_URI = process.env.MONGO_URI || process.env.DATABASE_URL;
if (!DB_URI) {
    console.error('❌  No MONGO_URI found in .env');
    process.exit(1);
}

async function main() {
    await mongoose.connect(DB_URI);
    console.log('✅  Connected to MongoDB');

    const db = mongoose.connection.db;
    const profiles   = db.collection('creatorprofiles');
    const posts      = db.collection('posts');
    const subs       = db.collection('subscriptions');

    // ── 1. Recalculate totalPosts for every creator ──────────────────────────
    console.log('\n📸  Recalculating totalPosts …');
    const postCounts = await posts.aggregate([
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
    ]).toArray();

    let postsFixed = 0;
    for (const { _id, count } of postCounts) {
        await profiles.updateOne(
            { userId: _id },
            { $set: { totalPosts: count } }
        );
        postsFixed++;
    }

    // Zero-out any creators with no posts at all (aggregate skips them)
    await profiles.updateMany(
        { userId: { $nin: postCounts.map(p => p._id) } },
        { $set: { totalPosts: 0 } }
    );

    console.log(`   ✔ Updated totalPosts for ${postsFixed} creator(s)`);

    // ── 2. Recalculate totalSubscribers (active only) ────────────────────────
    console.log('\n👥  Recalculating totalSubscribers (active & non-expired) …');
    const subCounts = await subs.aggregate([
        {
            $match: {
                status: 'active',
                expiresAt: { $gt: new Date() },
            },
        },
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
    ]).toArray();

    let subsFixed = 0;
    for (const { _id, count } of subCounts) {
        await profiles.updateOne(
            { userId: _id },
            { $set: { totalSubscribers: count } }
        );
        subsFixed++;
    }

    // Zero-out creators with no active subscribers
    await profiles.updateMany(
        { userId: { $nin: subCounts.map(s => s._id) } },
        { $set: { totalSubscribers: 0 } }
    );

    console.log(`   ✔ Updated totalSubscribers for ${subsFixed} creator(s)`);

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n🎉  Stats repair complete!\n');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌  Error:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
