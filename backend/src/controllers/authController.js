const {
    registerUserService,
    verifyOtpService,
    sendOtpService,
    loginWithOtpService,
    loginUserService,
    googleAuthService,
    forgotPasswordService,
    resetPasswordService,
} = require('../services/authService');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new user and send OTP
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const registerUser = async (req, res, next) => {
    try {
        const {
            name, email, password, role, profileLink,
            signupSource, creatorReferred,
        } = req.body;

        const { user, message } = await registerUserService({
            name, email, password, role, profileLink,
            signupSource, creatorReferred,
        });

        res.status(201).json({
            success: true,
            message,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Verify OTP (after registration or for email verification)
// @route   POST /api/auth/verify-otp
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const { user, token } = await verifyOtpService({ email, otp });

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Send OTP to email (for login or resend verification)
// @route   POST /api/auth/send-otp
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const sendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;
        await sendOtpService(email);
        res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login with OTP (passwordless)
// @route   POST /api/auth/login-otp
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const loginWithOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const { user, token } = await loginWithOtpService({ email, otp });

        res.status(200).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login with email and password
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const { user, token } = await loginUserService({ email, password });

        res.status(200).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                avatar: user.avatar,
                creatorApplicationStatus: user.creatorApplicationStatus,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Google OAuth login/register
// @route   POST /api/auth/google
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const googleAuth = async (req, res, next) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google token is required' });
        }

        const { user, token } = await googleAuthService(idToken);

        res.status(200).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                avatar: user.avatar,
                creatorApplicationStatus: user.creatorApplicationStatus,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .select('name email role isVerified isBanned avatar creatorApplicationStatus creatorRejectionReason signupSource creatorReferred createdAt walletBalance');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                isBanned: user.isBanned,
                avatar: user.avatar,
                creatorApplicationStatus: user.creatorApplicationStatus,
                creatorRejectionReason: user.creatorRejectionReason,
                signupSource: user.signupSource,
                creatorReferred: user.creatorReferred,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Forgot password — send reset link
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
    try {
        await forgotPasswordService(req.body.email);
        res.status(200).json({
            success: true,
            message: 'If an account exists for this email, a reset link has been sent.',
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
    try {
        const { token: resetToken, newPassword } = req.body;
        const { user, token } = await resetPasswordService({ token: resetToken, newPassword });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerUser,
    verifyOtp,
    sendOtp,
    loginWithOtp,
    loginUser,
    googleAuth,
    getMe,
    forgotPassword,
    resetPassword,
};
