/**
 * PM2 Ecosystem Config — Fannex Backend
 *
 * Run with: pm2 start ecosystem.config.js --update-env
 * Restart:  pm2 restart ecosystem.config.js --update-env
 *
 * This file locks the working directory so dotenv always finds .env,
 * and forces PM2 to load .env directly via dotenv's path option.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
    apps: [
        {
            name: 'fannex-backend',
            script: 'server.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: process.env.NODE_ENV || 'production',
                PORT: process.env.PORT || 8080,
                MONGO_URI: process.env.MONGO_URI,
                JWT_SECRET: process.env.JWT_SECRET,
                JWT_EXPIRE: process.env.JWT_EXPIRE,
                CASHFREE_APP_ID: process.env.CASHFREE_APP_ID,
                CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY,
                CASHFREE_ENV: process.env.CASHFREE_ENV || 'production',
                CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
                CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
                CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
                CLIENT_URL: process.env.CLIENT_URL,
                API_URL: process.env.API_URL,
                EMAIL_FROM: process.env.EMAIL_FROM,
                RESEND_API_KEY: process.env.RESEND_API_KEY,
                GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
        },
    ],
};
