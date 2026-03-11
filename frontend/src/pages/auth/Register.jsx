import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/helpers';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function Register() {
    const { register: authRegister, verifyOtp, googleLogin } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const fromParam = searchParams.get('from') || '';
    const creatorParam = searchParams.get('creator') || '';
    const redirect = searchParams.get('redirect') || '';
    const isCreatorFlow = fromParam === 'creator' && !!creatorParam;

    if (isCreatorFlow) {
        localStorage.setItem('fannex_fan_intent', 'true');
    }

    const redirectQuery = redirect
        ? `?redirect=${encodeURIComponent(redirect)}`
        : isCreatorFlow
            ? `?redirect=${encodeURIComponent(`/creator/${creatorParam}/subscribe`)}`
            : '';

    const [serverError, setServerError] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);
    const [step, setStep] = useState('form'); // 'form' | 'otp'
    const [registeredEmail, setRegisteredEmail] = useState('');

    // OTP state
    const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);

    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

    // ── Resend cooldown timer ────────────────────────────────────────────────
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // ── Google Sign-In (OAuth popup — avoids FedCM browser restrictions) ───────
    const googleCallbackRef = useRef(null);
    const googlePromptActiveRef = useRef(false); // guard against concurrent calls

    // Keep the callback ref always up-to-date (avoids stale closure)
    googleCallbackRef.current = async (response) => {
        setServerError('');
        setGoogleLoading(true);
        try {
            await googleLogin(response.credential);
            // Respect redirect flow (creator subscribe, etc.)
            const dest = redirect || (isCreatorFlow ? `/creator/${creatorParam}/subscribe` : '/');
            navigate(dest, { replace: true });
        } catch (err) {
            setServerError(getErrorMessage(err));
        } finally {
            setGoogleLoading(false);
            googlePromptActiveRef.current = false;
        }
    };

    // Launch Google OAuth in a popup window — no FedCM, works everywhere
    const handleGoogleBtnClick = useCallback(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId || googlePromptActiveRef.current || googleLoading) return;
        googlePromptActiveRef.current = true;

        const callbackWrapper = (response) => {
            if (response.credential) {
                googleCallbackRef.current?.(response);
            } else {
                googlePromptActiveRef.current = false;
            }
        };

        const doInit = () => {
            try { window.google?.accounts.id.cancel(); } catch (_) { /* ignore */ }

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: callbackWrapper,
                use_fedcm_for_prompt: false,  // ← disables FedCM; uses legacy popup
                cancel_on_tap_outside: false,
                ux_mode: 'popup',
            });
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    googlePromptActiveRef.current = false;
                    window.google.accounts.id.renderButton(
                        document.getElementById('g-signin-hidden-btn-reg'),
                        { type: 'standard', size: 'large', theme: 'filled_black' }
                    );
                    document.getElementById('g-signin-hidden-btn-reg')?.querySelector('div[role=button]')?.click();
                }
            });
        };

        if (window.google?.accounts?.id) { doInit(); return; }

        if (!document.getElementById('google-gsi-script')) {
            const script = document.createElement('script');
            script.id = 'google-gsi-script';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = doInit;
            script.onerror = () => { googlePromptActiveRef.current = false; };
            document.head.appendChild(script);
        } else {
            const wait = setInterval(() => {
                if (window.google?.accounts?.id) { clearInterval(wait); doInit(); }
            }, 100);
            setTimeout(() => { clearInterval(wait); googlePromptActiveRef.current = false; }, 5000);
        }
    }, [googleLoading]);

    // ── Submit registration ──────────────────────────────────────────────────
    const onSubmit = async (data) => {
        setServerError('');
        try {
            const { confirmPassword, ...payload } = data;
            if (isCreatorFlow) {
                payload.signupSource = 'creator_profile';
                payload.creatorReferred = creatorParam;
            }
            await authRegister(payload);
            setRegisteredEmail(data.email);
            setStep('otp');
            setResendCooldown(RESEND_COOLDOWN);
        } catch (err) {
            setServerError(getErrorMessage(err));
        }
    };

    // ── OTP input handling ───────────────────────────────────────────────────
    const handleOtpChange = useCallback((index, value) => {
        if (!/^\d?$/.test(value)) return;
        const updated = [...otpValues];
        updated[index] = value;
        setOtpValues(updated);
        setOtpError('');

        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && updated.every((v) => v !== '')) {
            submitOtp(updated.join(''));
        }
    }, [otpValues]);

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (paste.length === 0) return;
        const updated = Array(OTP_LENGTH).fill('');
        paste.split('').forEach((ch, i) => { updated[i] = ch; });
        setOtpValues(updated);
        const focusIdx = Math.min(paste.length, OTP_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();
        if (paste.length === OTP_LENGTH) submitOtp(paste);
    };

    // ── Verify OTP ───────────────────────────────────────────────────────────
    const submitOtp = async (code) => {
        setOtpError('');
        setVerifying(true);
        try {
            await verifyOtp(registeredEmail, code);
            const dest = redirect || (isCreatorFlow ? `/creator/${creatorParam}/subscribe` : '/');
            navigate(dest, { replace: true });
        } catch (err) {
            setOtpError(getErrorMessage(err));
            setOtpValues(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setVerifying(false);
        }
    };

    // ── Resend OTP ───────────────────────────────────────────────────────────
    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setOtpError('');
        try {
            await authService.sendOtp(registeredEmail);
            setResendCooldown(RESEND_COOLDOWN);
            setOtpValues(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } catch (err) {
            setOtpError(getErrorMessage(err));
        }
    };

    // ── OTP Verification Screen ──────────────────────────────────────────────
    if (step === 'otp') {
        return (
            <>
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📧</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Verify your email</h2>
                    <p className="text-sm text-surface-400">
                        We sent a 6-digit code to <strong className="text-white">{registeredEmail}</strong>
                    </p>
                </div>

                {otpError && (
                    <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                        {otpError}
                    </div>
                )}

                {/* OTP Input Boxes */}
                <div className="flex justify-center gap-2 sm:gap-2.5 mb-6 w-full px-2" onPaste={handleOtpPaste}>
                    {otpValues.map((val, i) => (
                        <input
                            key={i}
                            ref={(el) => (inputRefs.current[i] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={val}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            disabled={verifying}
                            autoFocus={i === 0}
                            style={{ flex: '1 1 0%', maxWidth: 48, aspectRatio: '1/1.15' }}
                            className={`text-center text-lg sm:text-xl font-bold rounded-xl border-2 bg-surface-800/50 text-white outline-none transition-all
                                ${val ? 'border-brand-500 shadow-[0_0_12px_rgba(204,82,184,0.2)]' : 'border-surface-600'}
                                focus:border-brand-500 focus:shadow-[0_0_12px_rgba(204,82,184,0.3)]
                                disabled:opacity-50`}
                        />
                    ))}
                </div>

                {/* Verifying spinner */}
                {verifying && (
                    <div className="flex items-center justify-center gap-2 mb-4 text-sm text-surface-400">
                        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        Verifying…
                    </div>
                )}

                {/* Resend */}
                <div className="text-center text-sm">
                    <p className="text-surface-500 mb-1">Didn't receive the code?</p>
                    {resendCooldown > 0 ? (
                        <p className="text-surface-600">Resend in {resendCooldown}s</p>
                    ) : (
                        <button
                            onClick={handleResend}
                            className="text-brand-400 hover:text-brand-300 font-medium"
                        >
                            Resend OTP
                        </button>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-surface-600">
                    Code expires in 10 minutes
                </p>
            </>
        );
    }

    // ── Registration Form ────────────────────────────────────────────────────
    return (
        <>
            {isCreatorFlow && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300 text-center">
                    🔒 Create a free account to subscribe to <strong>@{creatorParam}</strong>
                </div>
            )}

            <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
            <p className="text-sm text-surface-400 mb-6">Join thousands of creators on Fannex</p>

            {serverError && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {serverError}
                </div>
            )}

            {/* ── Google Sign-Up ──────────────────────────────────────────── */}
            <div className="mb-5">
                <button
                    type="button"
                    onClick={handleGoogleBtnClick}
                    disabled={googleLoading || !import.meta.env.VITE_GOOGLE_CLIENT_ID}
                    className="w-full flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        height: '48px',
                        borderRadius: '12px',
                        background: googleLoading ? '#222' : '#1a1a1a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#fff',
                    }}
                    onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.background = '#222'; }}
                    onMouseLeave={(e) => { if (!googleLoading) e.currentTarget.style.background = '#1a1a1a'; }}
                >
                    {googleLoading ? (
                        <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Signing up…
                        </span>
                    ) : (
                        <>
                            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                </button>
            </div>

            {/* ── OR Divider ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
            {/* Hidden GSI renderButton fallback — used when One-Tap prompt is suppressed */}
            <div id="g-signin-hidden-btn-reg" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }} />

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Name</label>
                    <input {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
                        type="text" placeholder="Your full name" className="input-dark" />
                    {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
                    <input {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                        type="email" placeholder="you@example.com" className="input-dark" />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
                    <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                        type="password" placeholder="Min 6 characters" className="input-dark" />
                    {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm Password</label>
                    <input {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (v) => v === watch('password') || 'Passwords do not match',
                    })} type="password" placeholder="••••••••" className="input-dark" />
                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-brand w-full mt-2">
                    {isSubmitting ? 'Creating account…' : 'Create account'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-surface-400">
                Already have an account?{' '}
                <Link to={`/login${redirectQuery}`} className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
            </p>
        </>
    );
}
