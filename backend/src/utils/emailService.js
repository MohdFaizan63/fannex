const { Resend } = require('resend');

// ─── Resend Client ────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_NAME = process.env.APP_NAME || 'Fannex';

/**
 * Generic send email helper using Resend
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const { data, error } = await resend.emails.send({
        from: `${APP_NAME} <${EMAIL_FROM}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''), // fallback plain text
    });

    if (error) {
        console.error('❌ Resend email error:', error);
        throw new Error(`Email send failed: ${error.message}`);
    }

    return data;
};

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Send OTP verification code to user
 */
const sendOtpEmail = async ({ name, email, otp }) => {
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0f0f13; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06);">
            <h2 style="color: #cc52b8; margin: 0 0 8px 0; font-size: 22px;">${APP_NAME}</h2>
            <p style="color: #e4e4e7; margin: 0 0 24px 0;">Hi <strong>${name}</strong>,</p>
            <p style="color: #a1a1aa; margin: 0 0 20px 0; font-size: 14px;">Your verification code is:</p>
            <div style="background: linear-gradient(135deg, rgba(204,82,184,0.15), rgba(124,58,237,0.15)); border: 1px solid rgba(204,82,184,0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', monospace;">${otp}</span>
            </div>
            <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 8px 0;">This code will expire in <strong style="color: #e4e4e7;">10 minutes</strong>.</p>
            <p style="color: #71717a; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                If you didn't request this code, you can safely ignore this email.
            </p>
        </div>
    `;

    return sendEmail({ to: email, subject: `${APP_NAME} Verification Code`, html });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async ({ name, email, token }) => {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0f0f13; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06);">
            <h2 style="color: #cc52b8; margin: 0 0 8px 0; font-size: 22px;">${APP_NAME}</h2>
            <p style="color: #e4e4e7; margin: 0 0 24px 0;">Hi <strong>${name}</strong>,</p>
            <p style="color: #a1a1aa; margin: 0 0 20px 0; font-size: 14px;">We received a request to reset your password. Click below to proceed:</p>
            <div style="text-align: center; margin: 0 0 24px 0;">
                <a href="${resetUrl}"
                   style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #cc52b8, #7c3aed); color: #ffffff; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
                    Reset Password
                </a>
            </div>
            <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 8px 0;">This link expires in <strong style="color: #e4e4e7;">15 minutes</strong>.</p>
            <p style="color: #71717a; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    `;

    return sendEmail({ to: email, subject: `Password Reset — ${APP_NAME}`, html });
};

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };
