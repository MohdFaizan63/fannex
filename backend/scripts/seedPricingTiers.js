/**
 * seedPricingTiers.js — One-time seed script for geo pricing tiers
 *
 * Run from the backend directory:
 *   node scripts/seedPricingTiers.js
 *
 * This inserts the default USD pricing bands. Safe to run multiple times —
 * existing tiers are cleared first (idempotent).
 *
 * USD Pricing Bands (applies to both US and ROW regions):
 *   ₹0   – ₹149   → $4.99
 *   ₹150 – ₹299   → $7.99
 *   ₹300 – ₹499   → $9.99
 *   ₹500 – ₹999   → $14.99
 *   ₹1000+        → $19.99
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PricingTier = require('../src/models/PricingTier');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

/** Default tiers — applied for BOTH US and ROW regions */
const TIERS = [
    { region: 'ROW', minInr: 0,    maxInr: 149,  usdPrice: 4.99  },
    { region: 'ROW', minInr: 150,  maxInr: 299,  usdPrice: 7.99  },
    { region: 'ROW', minInr: 300,  maxInr: 499,  usdPrice: 9.99  },
    { region: 'ROW', minInr: 500,  maxInr: 999,  usdPrice: 14.99 },
    { region: 'ROW', minInr: 1000, maxInr: null, usdPrice: 19.99 },
    // US-specific tiers (same bands currently, kept separate for future tuning)
    { region: 'US',  minInr: 0,    maxInr: 149,  usdPrice: 4.99  },
    { region: 'US',  minInr: 150,  maxInr: 299,  usdPrice: 7.99  },
    { region: 'US',  minInr: 300,  maxInr: 499,  usdPrice: 9.99  },
    { region: 'US',  minInr: 500,  maxInr: 999,  usdPrice: 14.99 },
    { region: 'US',  minInr: 1000, maxInr: null, usdPrice: 19.99 },
];

async function seed() {
    if (!MONGO_URI) {
        console.error('❌  MONGO_URI not set in .env');
        process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB');

    // Clear existing tiers (idempotent re-run)
    const { deletedCount } = await PricingTier.deleteMany({});
    console.log(`🗑️  Cleared ${deletedCount} existing tiers`);

    const inserted = await PricingTier.insertMany(TIERS.map(t => ({ ...t, active: true })));
    console.log(`🌱  Seeded ${inserted.length} pricing tiers:`);

    inserted.forEach(t => {
        const max = t.maxInr !== null ? `₹${t.maxInr}` : '∞';
        console.log(`   [${t.region}] ₹${t.minInr}–${max} → $${t.usdPrice}`);
    });

    await mongoose.disconnect();
    console.log('👋  Done');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
});
