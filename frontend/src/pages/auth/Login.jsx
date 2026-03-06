import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/helpers';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function Login() {
    const { login, loginWithOtp, googleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const from = searchParams.get('redirect') || location.state?.from?.pathname || '/';
    const redirectQuery = searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect'))}` : '';
    const isSubscribeFlow = from.includes('/subscribe');
    const creatorName = isSubscribeFlow ? from.split('/creator/')?.[1]?.split('/')[0] || '' : '';

    // Mode: 'password' | 'otp-email' | 'otp-verify'
    const [mode, setMode] = useState('password');
    const [serverError, setServerError] = useState('');
    const [otpEmail, setOtpEmail] = useState('');
    const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''));
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [googleLoading, setGoogleLoading] = useState(false);
    const inputRefs = useRef([]);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    // ── Resend cooldown ──────────────────────────────────────────────────────
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // ── Google Sign-In ───────────────────────────────────────────────────────
    const googleCallbackRef = useRef(null);

    // Keep the callback ref always up-to-date
    googleCallbackRef.current = async (response) => {
        setServerError('');
        setGoogleLoading(true);
        try {
            await googleLogin(response.credential);
            navigate(from, { replace: true });
        } catch (err) {
            setServerError(getErrorMessage(err));
        } finally {
            setGoogleLoading(false);
        }
    };

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        // Wrapper that calls the ref (always the latest version)
        const callbackWrapper = (response) => googleCallbackRef.current?.(response);

        const initGoogle = () => {
            window.google?.accounts.id.initialize({
                client_id: clientId,
                callback: callbackWrapper,
            });
            window.google?.accounts.id.renderButton(
                document.getElementById('google-signin-btn'),
                {
                    theme: 'filled_black',
                    size: 'large',
                    width: 400,
                    shape: 'pill',
                    text: 'continue_with',
                }
            );
        };

        // If the script is already loaded (e.g. hot reload)
        if (window.google?.accounts) {
            initGoogle();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
        return () => { script.remove(); };
    }, []);

    // ── Email + Password Login ───────────────────────────────────────────────
    const onPasswordSubmit = async (data) => {
        setServerError('');
        try {
            await login(data);
            navigate(from, { replace: true });
        } catch (err) {
            setServerError(getErrorMessage(err));
        }
    };

    // ── Send OTP for login ───────────────────────────────────────────────────
    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!otpEmail.trim()) return;
        setServerError('');
        setSendingOtp(true);
        try {
            await authService.sendOtp(otpEmail.trim());
            setMode('otp-verify');
            setResendCooldown(RESEND_COOLDOWN);
        } catch (err) {
            setServerError(getErrorMessage(err));
        } finally {
            setSendingOtp(false);
        }
    };

    // ── OTP input ────────────────────────────────────────────────────────────
    const handleOtpChange = useCallback((index, value) => {
        if (!/^\d?$/.test(value)) return;
        const updated = [...otpValues];
        updated[index] = value;
        setOtpValues(updated);
        setOtpError('');
        if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
        if (value && updated.every((v) => v !== '')) submitOtpLogin(updated.join(''));
    }, [otpValues, otpEmail]);

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!paste.length) return;
        const updated = Array(OTP_LENGTH).fill('');
        paste.split('').forEach((ch, i) => { updated[i] = ch; });
        setOtpValues(updated);
        inputRefs.current[Math.min(paste.length, OTP_LENGTH - 1)]?.focus();
        if (paste.length === OTP_LENGTH) submitOtpLogin(paste);
    };

    const submitOtpLogin = async (code) => {
        setOtpError('');
        setVerifying(true);
        try {
            await loginWithOtp(otpEmail.trim(), code);
            navigate(from, { replace: true });
        } catch (err) {
            setOtpError(getErrorMessage(err));
            setOtpValues(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setVerifying(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        setOtpError('');
        try {
            await authService.sendOtp(otpEmail.trim());
            setResendCooldown(RESEND_COOLDOWN);
            setOtpValues(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } catch (err) {
            setOtpError(getErrorMessage(err));
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <>
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-sm text-surface-400 mb-6">Sign in to your Fannex account</p>

            {isSubscribeFlow && creatorName && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300 text-center">
                    🔒 Sign in to subscribe to <strong>@{creatorName}</strong>
                </div>
            )}

            {serverError && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {serverError}
                </div>
            )}

            {/* ── Google Sign-In ──────────────────────────────────────────── */}
            <div className="mb-5">
                <div id="google-signin-btn" className="flex justify-center" />
                {googleLoading && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-surface-400">
                        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        Signing in with Google…
                    </div>
                )}
                {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                    <button disabled className="w-full flex items-center justify-center gap-3 py-2.5 rounded-full border border-surface-600 bg-surface-800/50 text-surface-400 text-sm cursor-not-allowed">
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Continue with Google
                    </button>
                )}
            </div>

            {/* ── Divider ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-surface-700" />
                <span className="text-xs text-surface-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-surface-700" />
            </div>

            {/* ── OTP Login — Enter Email ─────────────────────────────────── */}
            {mode === 'otp-email' && (
                <>
                    <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                className="input-dark"
                                value={otpEmail}
                                onChange={(e) => setOtpEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <button type="submit" disabled={sendingOtp} className="btn-brand w-full">
                            {sendingOtp ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Sending OTP…
                                </span>
                            ) : '📧 Send Login Code'}
                        </button>
                    </form>

                    <button
                        onClick={() => { setMode('password'); setServerError(''); }}
                        className="mt-4 w-full text-center text-sm text-surface-500 hover:text-surface-300"
                    >
                        ← Back to password login
                    </button>
                </>
            )}

            {/* ── OTP Login — Enter Code ──────────────────────────────────── */}
            {mode === 'otp-verify' && (
                <>
                    <div className="text-center mb-6">
                        <p className="text-sm text-surface-400">
                            Enter the 6-digit code sent to <strong className="text-white">{otpEmail}</strong>
                        </p>
                    </div>

                    {otpError && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            {otpError}
                        </div>
                    )}

                    <div className="flex justify-center gap-2.5 mb-5" onPaste={handleOtpPaste}>
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
                                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-surface-800/50 text-white outline-none transition-all
                                    ${val ? 'border-brand-500 shadow-[0_0_12px_rgba(204,82,184,0.2)]' : 'border-surface-600'}
                                    focus:border-brand-500 focus:shadow-[0_0_12px_rgba(204,82,184,0.3)]
                                    disabled:opacity-50`}
                            />
                        ))}
                    </div>

                    {verifying && (
                        <div className="flex items-center justify-center gap-2 mb-4 text-sm text-surface-400">
                            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                            Signing in…
                        </div>
                    )}

                    <div className="text-center text-sm mb-4">
                        {resendCooldown > 0 ? (
                            <p className="text-surface-600">Resend in {resendCooldown}s</p>
                        ) : (
                            <button onClick={handleResendOtp} className="text-brand-400 hover:text-brand-300 font-medium">
                                Resend OTP
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => { setMode('otp-email'); setOtpValues(Array(OTP_LENGTH).fill('')); setOtpError(''); setServerError(''); }}
                        className="w-full text-center text-sm text-surface-500 hover:text-surface-300"
                    >
                        ← Change email
                    </button>
                </>
            )}

            {/* ── Password Login ──────────────────────────────────────────── */}
            {mode === 'password' && (
                <>
                    <form onSubmit={handleSubmit(onPasswordSubmit)} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
                            <input
                                {...register('email', { required: 'Email is required' })}
                                type="email" placeholder="you@example.com"
                                className="input-dark"
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1.5">Password</label>
                            <input
                                {...register('password', { required: 'Password is required' })}
                                type="password" placeholder="••••••••"
                                className="input-dark"
                            />
                            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
                            <div className="mt-2 text-right">
                                <Link to="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</Link>
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="btn-brand w-full mt-1">
                            {isSubmitting ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    {/* OTP login toggle */}
                    <button
                        onClick={() => { setMode('otp-email'); setServerError(''); }}
                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-surface-700 text-sm text-surface-400 hover:text-white hover:border-brand-500/40 transition-all"
                    >
                        📧 Login with OTP instead
                    </button>
                </>
            )}

            {/* ── Sign up link ────────────────────────────────────────────── */}
            <p className="mt-6 text-center text-sm text-surface-400">
                Don't have an account?{' '}
                <Link to={`/register${redirectQuery}`} className="text-brand-400 hover:text-brand-300 font-medium">Sign up free</Link>
            </p>
        </>
    );
}
