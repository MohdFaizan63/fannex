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
    const otpDigits = String(otp).split('').map(d =>
        `<td style="width:44px;height:52px;text-align:center;font-size:28px;font-weight:800;color:#ffffff;font-family:'Courier New',monospace;background:rgba(204,82,184,0.12);border:1px solid rgba(204,82,184,0.25);border-radius:10px;">${d}</td>`
    ).join('\n                            <td style="width:8px;"></td>');

    const html = `
        <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 0; background: #0a0a0f;">
            <div style="padding: 40px 32px 32px; background: linear-gradient(180deg, #0f0f15 0%, #0a0a0f 100%); border-radius: 0 0 16px 16px;">
                <h2 style="color: #cc52b8; margin: 0 0 24px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">${APP_NAME}</h2>
                <p style="color: #e4e4e7; margin: 0 0 6px 0; font-size: 16px;">Hi <strong>${name}</strong>,</p>
                <p style="color: #a1a1aa; margin: 0 0 28px 0; font-size: 14px; line-height: 1.5;">Your verification code is:</p>
                <table cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 28px; border-collapse: separate;">
                    <tr>
                        ${otpDigits}
                    </tr>
                </table>
                <p style="color: #a1a1aa; font-size: 13px; margin: 0 0 8px 0; text-align: center;">This code will expire in <strong style="color: #e4e4e7;">10 minutes</strong>.</p>
                <div style="border-top: 1px solid rgba(255,255,255,0.06); margin-top: 28px; padding-top: 16px;">
                    <p style="color: #52525b; font-size: 12px; margin: 0; text-align: center;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            </div>
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
