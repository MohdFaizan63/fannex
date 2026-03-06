import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/helpers';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function Register() {
    const { register: authRegister, verifyOtp } = useAuth();
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
                <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
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
            <p className="text-sm text-surface-400 mb-8">Join thousands of creators on Fannex</p>

            {serverError && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {serverError}
                </div>
            )}

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
