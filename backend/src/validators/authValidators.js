const Joi = require('joi');

// ─── Register ─────────────────────────────────────────────────────────────────
const registerSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(80)
        .required()
        .label('Name'),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .required()
        .label('Email'),

    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .label('Password')
        .messages({
            'string.min': 'Password must be at least 6 characters.',
        }),

    // Signup intent tracking — sent when user comes from a creator profile
    signupSource: Joi.string()
        .valid('user_default', 'creator_profile')
        .optional()
        .label('Signup Source'),

    creatorReferred: Joi.string()
        .max(60)
        .optional()
        .allow('')
        .label('Creator Referred'),

    // Frontend sends these but we handle them client-side only
    role: Joi.string().optional(),
    profileLink: Joi.string().optional().allow(''),
});

// ─── Login ────────────────────────────────────────────────────────────────────
const loginSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .required()
        .label('Email'),

    password: Joi.string()
        .required()
        .label('Password'),
});

// ─── Verify OTP ───────────────────────────────────────────────────────────────
const verifyOtpSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .required()
        .label('Email'),

    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .label('OTP')
        .messages({
            'string.length': 'OTP must be exactly 6 digits.',
            'string.pattern.base': 'OTP must be exactly 6 digits.',
        }),
});

// ─── Send OTP ─────────────────────────────────────────────────────────────────
const sendOtpSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .required()
        .label('Email'),
});

// ─── Google Auth ──────────────────────────────────────────────────────────────
const googleAuthSchema = Joi.object({
    idToken: Joi.string()
        .required()
        .label('Google ID Token'),
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .required()
        .label('Email'),
});

// ─── Reset Password ───────────────────────────────────────────────────────────
const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .label('Reset Token'),

    newPassword: Joi.string()
        .min(6)
        .max(128)
        .required()
        .label('New Password')
        .messages({
            'string.min': 'New password must be at least 6 characters.',
        }),
});

module.exports = {
    registerSchema,
    loginSchema,
    verifyOtpSchema,
    sendOtpSchema,
    googleAuthSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
};
