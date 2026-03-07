const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Please add a name'] },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            index: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
        },
        password: { type: String, minlength: 6, select: false }, // optional for Google users
        role: { type: String, enum: ['user', 'creator', 'admin'], default: 'user' },
        creatorApplicationStatus: {
            type: String,
            enum: ['none', 'pending', 'approved', 'rejected'],
            default: 'none',
        },
        creatorRejectionReason: { type: String, default: '' },
        isVerified: { type: Boolean, default: false },
        isBanned: { type: Boolean, default: false },
        subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }],
        walletBalance: { type: Number, default: 0, min: 0 }, // fan wallet for paid chat
        signupSource: { type: String, enum: ['user_default', 'creator_profile', 'google'], default: 'user_default' },
        creatorReferred: { type: String, default: '' },

        // Google OAuth
        googleId: { type: String, sparse: true },
        avatar: { type: String, default: '' },

        // OTP verification
        otpCode: { type: String, select: false },
        otpExpiry: { type: Date, select: false },

        // OTP rate limiting (max 5 per hour)
        otpRequestCount: { type: Number, default: 0, select: false },
        otpRequestWindowStart: { type: Date, select: false },

        // Password reset (kept as-is)
        passwordResetToken: { type: String, select: false },
        passwordResetExpiry: { type: Date, select: false },
    },
    { timestamps: true }
);

// Mongoose 7+ async pre-hooks do NOT take a `next` parameter.
userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
