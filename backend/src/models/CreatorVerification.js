const mongoose = require('mongoose');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM Field Encryption Helpers
// ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars) in .env
// ─────────────────────────────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || Buffer.from(key, 'hex').length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(key, 'hex');
};

const encrypt = (plainText) => {
    if (!plainText) return null;
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    // Store as iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const decrypt = (cipherText) => {
    if (!cipherText) return null;
    const [ivHex, authTagHex, encrypted] = cipherText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// ─────────────────────────────────────────────────────────────────────────────
// Encrypted Field Schema Type Helper
// ─────────────────────────────────────────────────────────────────────────────
const encryptedField = (required = false) => ({
    type: String,
    required,
    set: (val) => (val ? encrypt(val) : val),           // auto-encrypt on save
    get: (val) => (val ? decrypt(val) : val),           // auto-decrypt on read
});

// ─────────────────────────────────────────────────────────────────────────────
// CreatorVerification Schema
// ─────────────────────────────────────────────────────────────────────────────
const creatorVerificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,   // one verification record per creator
            index: true,
        },

        // ── Encrypted sensitive identity fields ──────────────────────────────
        aadhaarNumber: { ...encryptedField(true) },
        panNumber: { ...encryptedField(true) },
        bankAccountNumber: { ...encryptedField(true) },

        // ── Non-sensitive bank field (no encryption needed) ──────────────────
        ifscCode: {
            type: String,
            required: [true, 'IFSC code is required'],
            uppercase: true,
            match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please enter a valid IFSC code'],
        },

        // ── Plain-text bank metadata (not sensitive) ──────────────────────────
        accountHolderName: { type: String, default: '' },
        bankName: { type: String, default: '' },

        // ── Document image URLs (stored on Cloudinary, optional if not configured) ─
        aadhaarImageUrl: { type: String, default: '' },
        panImageUrl: { type: String, default: '' },
        bankProofImageUrl: { type: String, default: '' },

        // ── Verification status ───────────────────────────────────────────────
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        rejectionReason: {
            type: String,
            default: null,
        },

        // ── Admin who approved/rejected ───────────────────────────────────────
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        // ── Audit timestamps ─────────────────────────────────────────────────
        submittedAt: {
            type: Date,
            default: Date.now,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        // Enable getters so decrypt runs automatically on .toObject() / .toJSON()
        toObject: { getters: true },
        toJSON: { getters: true },
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────
creatorVerificationSchema.index({ status: 1, submittedAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Static Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expose encrypt/decrypt as static helpers so controllers can
 * also encrypt values before querying (e.g. lookup by aadhaar):
 *   CreatorVerification.encrypt('123456789012')
 */
creatorVerificationSchema.statics.encrypt = encrypt;
creatorVerificationSchema.statics.decrypt = decrypt;

module.exports = mongoose.model('CreatorVerification', creatorVerificationSchema);
