const express = require('express');
const router = express.Router();
const {
    registerUser,
    verifyOtp,
    sendOtp,
    loginWithOtp,
    loginUser,
    googleAuth,
    getMe,
    forgotPassword,
    resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/validate');
const {
    registerSchema,
    loginSchema,
    verifyOtpSchema,
    sendOtpSchema,
    googleAuthSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} = require('../validators/authValidators');

// ── Public routes ──────────────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/send-otp', validate(sendOtpSchema), sendOtp);
router.post('/login-otp', validate(verifyOtpSchema), loginWithOtp);
router.post('/google', validate(googleAuthSchema), googleAuth);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// ── Logout (stateless JWT — just acknowledge; client removes token) ─────────────
router.post('/logout', (req, res) => {
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// ── Protected routes ───────────────────────────────────────────────────────────
router.get('/me', protect, getMe);

module.exports = router;
