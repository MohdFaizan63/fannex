const crypto = require('crypto');
const User = require('../models/User');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/emailService');
const generateToken = require('../utils/generateToken');

// ─── OTP Helpers ──────────────────────────────────────────────────────────────

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
};

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_REQUESTS = 5;
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check OTP rate limit and generate + save a new OTP.
 * Sends the OTP email (or logs to console if SMTP not configured).
 */
const generateAndSendOtp = async (user) => {
    // Rate limiting: max 5 OTP requests per hour
    const now = new Date();
    const windowStart = user.otpRequestWindowStart;
    if (windowStart && (now - windowStart) < OTP_RATE_WINDOW_MS) {
        if (user.otpRequestCount >= OTP_MAX_REQUESTS) {
            const err = new Error('Too many OTP requests. Please try again in an hour.');
            err.statusCode = 429;
            throw err;
        }
        user.otpRequestCount += 1;
    } else {
        // New window
        user.otpRequestWindowStart = now;
        user.otpRequestCount = 1;
    }

    const otp = generateOtp();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send email
    const emailConfigured = !!(process.env.RESEND_API_KEY || process.env.SMTP_USER);
    if (emailConfigured) {
        try {
            await sendOtpEmail({ name: user.name, email: user.email, otp });
        } catch (emailErr) {
            console.error('Failed to send OTP email:', emailErr.message);
        }
    } else {
        console.warn(`[DEV - NO EMAIL] OTP for ${user.email}: ${otp}`);
    }

    return otp;
};

// ─── Register User ────────────────────────────────────────────────────────────

const registerUserService = async ({ name, email, password, role, profileLink, signupSource, creatorReferred }) => {
    const existing = await User.findOne({ email });

    if (existing) {
        // Give a specific, actionable error based on how the account was created
        if (existing.googleId || existing.signupSource === 'google') {
            const err = new Error('This email is already linked to a Google account. Please use "Continue with Google" to sign in.');
            err.statusCode = 400;
            throw err;
        }
        const err = new Error('An account with this email already exists. Please sign in or reset your password.');
        err.statusCode = 400;
        throw err;
    }

    const user = await User.create({
        name,
        email,
        password,
        role: role || 'user',
        profileLink,
        signupSource: signupSource || 'user_default',
        creatorReferred: creatorReferred || '',
    });

    // Generate and send OTP
    const selectUser = await User.findById(user._id).select('+otpCode +otpExpiry +otpRequestCount +otpRequestWindowStart');
    await generateAndSendOtp(selectUser);

    return { user, message: 'OTP sent to your email' };
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

const verifyOtpService = async ({ email, otp }) => {
    if (!email || !otp) {
        const err = new Error('Email and OTP are required');
        err.statusCode = 400;
        throw err;
    }

    const user = await User.findOne({ email }).select('+otpCode +otpExpiry');

    if (!user) {
        const err = new Error('No account found with this email');
        err.statusCode = 404;
        throw err;
    }

    if (!user.otpCode || !user.otpExpiry) {
        const err = new Error('No OTP was requested. Please request a new one.');
        err.statusCode = 400;
        throw err;
    }

    if (new Date() > user.otpExpiry) {
        const err = new Error('OTP has expired. Please request a new one.');
        err.statusCode = 400;
        throw err;
    }

    if (user.otpCode !== otp.toString()) {
        const err = new Error('Invalid OTP. Please try again.');
        err.statusCode = 400;
        throw err;
    }

    // OTP is valid — mark verified and clear OTP
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return {
        user,
        token: generateToken(user._id, user.role),
    };
};

// ─── Send OTP (for login or resend) ───────────────────────────────────────────

const sendOtpService = async (email) => {
    const user = await User.findOne({ email }).select('+otpCode +otpExpiry +otpRequestCount +otpRequestWindowStart');

    if (!user) {
        const err = new Error('No account found with this email');
        err.statusCode = 404;
        throw err;
    }

    if (user.isBanned) {
        const err = new Error('Your account has been suspended.');
        err.statusCode = 403;
        throw err;
    }

    await generateAndSendOtp(user);
    return true;
};

// ─── Login with OTP (passwordless) ────────────────────────────────────────────

const loginWithOtpService = async ({ email, otp }) => {
    if (!email || !otp) {
        const err = new Error('Email and OTP are required');
        err.statusCode = 400;
        throw err;
    }

    const user = await User.findOne({ email }).select('+otpCode +otpExpiry');

    if (!user) {
        const err = new Error('No account found with this email');
        err.statusCode = 404;
        throw err;
    }

    if (user.isBanned) {
        const err = new Error('Your account has been suspended.');
        err.statusCode = 403;
        throw err;
    }

    if (!user.otpCode || !user.otpExpiry) {
        const err = new Error('No OTP was requested. Please request a new one.');
        err.statusCode = 400;
        throw err;
    }

    if (new Date() > user.otpExpiry) {
        const err = new Error('OTP has expired. Please request a new one.');
        err.statusCode = 400;
        throw err;
    }

    if (user.otpCode !== otp.toString()) {
        const err = new Error('Invalid OTP. Please try again.');
        err.statusCode = 400;
        throw err;
    }

    // OTP valid — mark verified, clear OTP, and login
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return {
        user,
        token: generateToken(user._id, user.role),
    };
};

// ─── Login User (email + password) ────────────────────────────────────────────

const loginUserService = async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }

    if (!user.isVerified) {
        const err = new Error('Please verify your email before logging in. Use the OTP sent to your email.');
        err.statusCode = 403;
        throw err;
    }

    if (user.isBanned) {
        const err = new Error('Your account has been suspended.');
        err.statusCode = 403;
        throw err;
    }

    return { user, token: generateToken(user._id, user.role) };
};

// ─── Google Auth ──────────────────────────────────────────────────────────────

const googleAuthService = async (idToken) => {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch (verifyErr) {
        const err = new Error('Invalid Google token');
        err.statusCode = 401;
        throw err;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
        const err = new Error('Google account has no email');
        err.statusCode = 400;
        throw err;
    }

    // Check if user already exists
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
        // Link Google ID if not already
        if (!user.googleId) {
            user.googleId = googleId;
            if (picture && !user.avatar) user.avatar = picture;
            await user.save({ validateBeforeSave: false });
        }
        // Ensure verified
        if (!user.isVerified) {
            user.isVerified = true;
            await user.save({ validateBeforeSave: false });
        }
    } else {
        // Create new user
        user = await User.create({
            name: name || email.split('@')[0],
            email,
            googleId,
            avatar: picture || '',
            isVerified: true,
            signupSource: 'google',
        });
    }

    if (user.isBanned) {
        const err = new Error('Your account has been suspended.');
        err.statusCode = 403;
        throw err;
    }

    return { user, token: generateToken(user._id, user.role) };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPasswordService = async (email) => {
    const user = await User.findOne({ email });
    if (!user) return true;

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiry = expiry;
    await user.save({ validateBeforeSave: false });

    const emailConfigured = !!(process.env.RESEND_API_KEY || process.env.SMTP_USER);
    if (emailConfigured) {
        try {
            await sendPasswordResetEmail({ name: user.name, email: user.email, token: plainToken });
        } catch (emailErr) {
            user.passwordResetToken = undefined;
            user.passwordResetExpiry = undefined;
            await user.save({ validateBeforeSave: false });
            const err = new Error('Failed to send reset email. Please try again later.');
            err.statusCode = 500;
            throw err;
        }
    } else {
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${plainToken}`;
        console.warn(`[DEV - NO EMAIL] Password reset link for ${user.email}: ${resetUrl}`);
    }

    return true;
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPasswordService = async ({ token, newPassword }) => {
    if (!token || !newPassword) {
        const err = new Error('Token and new password are required');
        err.statusCode = 400;
        throw err;
    }

    if (newPassword.length < 6) {
        const err = new Error('Password must be at least 6 characters');
        err.statusCode = 400;
        throw err;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiry: { $gt: now },
    }).select('+password +passwordResetToken +passwordResetExpiry');

    if (!user) {
        const err = new Error('Invalid or expired password reset token');
        err.statusCode = 400;
        throw err;
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save();

    return { user, token: generateToken(user._id, user.role) };
};

module.exports = {
    registerUserService,
    verifyOtpService,
    sendOtpService,
    loginWithOtpService,
    loginUserService,
    googleAuthService,
    forgotPasswordService,
    resetPasswordService,
};