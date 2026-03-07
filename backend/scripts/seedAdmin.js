/**
 * seedAdmin.js
 * Run once to create / update the admin user in MongoDB.
 * Usage:  node scripts/seedAdmin.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL = 'mananfaizanekansh@gmail.com';
const ADMIN_PASSWORD = '1e71c3373d872357076a6d8e0c384d53b3dd336eeee2338ceb27d3bbbe02883d';
const ADMIN_NAME = 'Fannex Admin';

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fannex');
        console.log('✅ Connected to MongoDB');

        // Require User model AFTER connection
        const User = require('../src/models/User');

        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

        const result = await User.findOneAndUpdate(
            { email: ADMIN_EMAIL },
            {
                $set: {
                    name: ADMIN_NAME,
                    email: ADMIN_EMAIL,
                    password: hashed,
                    role: 'admin',
                    isVerified: true,
                    isBanned: false,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Admin user upserted: ${result.email}  (role: ${result.role})`);
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

seed();
