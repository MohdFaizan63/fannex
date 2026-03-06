/**
 * One-time script to create or update an admin user.
 * Usage:  node scripts/createAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const ADMIN_EMAIL = 'mananfaizanekansh@gmail.com';
const ADMIN_PASSWORD = 'K#8mP!L9vR2@qNx';
const ADMIN_NAME = 'Admin';

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    let user = await User.findOne({ email: ADMIN_EMAIL });

    if (user) {
        // Upgrade existing account to admin
        user.role = 'admin';
        user.isVerified = true;
        user.isBanned = false;
        user.password = ADMIN_PASSWORD; // will be hashed by pre-save hook
        await user.save();
        console.log(`✅ Existing user updated to admin: ${ADMIN_EMAIL}`);
    } else {
        // Create brand-new admin user
        user = await User.create({
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: 'admin',
            isVerified: true,
        });
        console.log(`✅ Admin user created: ${ADMIN_EMAIL}`);
    }

    console.log('\n🔑 Admin login details:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   URL:      http://localhost:3000/admin\n`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
