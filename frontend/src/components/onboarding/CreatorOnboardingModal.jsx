import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import StepProgress from './StepProgress';
import CountryStep from './CountryStep';
import CreatorTypeStep from './CreatorTypeStep';
import CreatorProfileStep from './CreatorProfileStep';
import SubscriptionPriceStep from './SubscriptionPriceStep';
import IdentityVerificationStep from './IdentityVerificationStep';
import SuccessStep from './SuccessStep';
import { applyForCreator } from '../../services/creatorService';

const TOTAL_STEPS = 6;

export default function CreatorOnboardingModal({ isOpen, onClose, onSuccess }) {
    const { refreshUser } = useAuth();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const scrollRef = useRef(null);

    const {
        register, handleSubmit, watch, setValue, setError, clearErrors, trigger,
        formState: { errors },
    } = useForm({ mode: 'onChange' });

    // Lock body scroll when modal open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Scroll step content back to top on step change
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [step]);

    const handleClose = useCallback(() => {
        setStep(0);
        setSubmitError('');
        onClose();
    }, [onClose]);

    const STEP_FIELDS = [
        ['countryOfResidency'],
        ['creatorType'],
        ['displayName', 'username'],
        ['subscriptionPrice'],
        ['fullName', 'panNumber', 'aadhaarNumber', 'bankAccountNumber', 'ifscCode', 'aadhaarImage', 'panImage', 'bankProofImage'],
    ];

    const next = async () => {
        const fields = STEP_FIELDS[step];
        if (fields) {
            const ok = await trigger(fields);
            if (!ok) return;
        }
        setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
    };

    const back = () => { setStep(s => Math.max(s - 1, 0)); setSubmitError(''); };

    const onSubmit = async (data) => {
        setSubmitting(true);
        setSubmitError('');
        try {
            const fd = new FormData();
            fd.append('countryOfResidency', data.countryOfResidency);
            fd.append('creatorType', data.creatorType);
            fd.append('displayName', data.displayName);
            fd.append('username', data.username);
            fd.append('bio', data.bio || '');
            fd.append('subscriptionPrice', data.subscriptionPrice);
            fd.append('fullName', data.fullName);
            fd.append('panNumber', data.panNumber);
            fd.append('aadhaarNumber', data.aadhaarNumber);
            fd.append('bankAccountNumber', data.bankAccountNumber);
            fd.append('ifscCode', data.ifscCode);
            if (data.aadhaarImage) fd.append('aadhaarImage', data.aadhaarImage);
            if (data.panImage) fd.append('panImage', data.panImage);
            if (data.bankProofImage) fd.append('bankProofImage', data.bankProofImage);
            await applyForCreator(fd);
            try { await refreshUser(); } catch (_) { /* non-critical */ }
            setStep(5);
            if (onSuccess) onSuccess();
        } catch (err) {
            setSubmitError(err?.response?.data?.message || 'Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isLastStep = step === TOTAL_STEPS - 2;
    const isSuccess = step === TOTAL_STEPS - 1;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
            style={{ padding: '0' }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={handleClose} />

            {/* Modal — slides up from bottom on mobile, centered on desktop */}
            <div
                className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
                style={{
                    background: 'linear-gradient(180deg, rgba(15,5,35,0.98) 0%, rgba(8,3,20,0.99) 100%)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderBottom: 'none',
                    borderRadius: '24px 24px 0 0',
                    boxShadow: '0 -20px 80px rgba(124,58,237,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
                    // Critical: use dynamic viewport height so modal never hides behind the virtual keyboard
                    maxHeight: '92dvh',
                    animation: 'slideUpModal 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
                // Also use sm: for desktop centering styles
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gradient pill handle (mobile drag indicator) */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-1 pb-3 flex-shrink-0">
                    <div>
                        <h1 className="text-base font-black text-white tracking-tight">
                            {isSuccess ? '🎉 Application Submitted' : 'Become a Creator'}
                        </h1>
                        {!isSuccess && (
                            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                Join thousands earning on Fannex
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress */}
                {!isSuccess && (
                    <div className="px-5 flex-shrink-0">
                        <StepProgress current={step} />
                    </div>
                )}

                {/* Scrollable step content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain px-5 pb-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    <form id="onboarding-form" onSubmit={handleSubmit(onSubmit)}>
                        {step === 0 && <CountryStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 1 && <CreatorTypeStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 2 && <CreatorProfileStep register={register} errors={errors} watch={watch} setValue={setValue} setError={setError} clearErrors={clearErrors} />}
                        {step === 3 && <SubscriptionPriceStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 4 && <IdentityVerificationStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 5 && <SuccessStep onClose={handleClose} />}
                    </form>
                </div>

                {/* Footer nav — always visible above keyboard */}
                {!isSuccess && (
                    <div
                        className="px-5 pt-3 pb-5 flex-shrink-0"
                        style={{
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            background: 'linear-gradient(0deg, rgba(8,3,20,1) 0%, transparent 100%)',
                        }}
                    >
                        {submitError && (
                            <div className="mb-3 px-3 py-2 rounded-xl text-xs text-red-400 flex items-center gap-2"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                <span>⚠</span> {submitError}
                            </div>
                        )}

                        <div className="flex gap-3">
                            {step > 0 && (
                                <button
                                    type="button"
                                    onClick={back}
                                    className="flex-none px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200"
                                    style={{
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'rgba(255,255,255,0.6)',
                                        background: 'rgba(255,255,255,0.04)',
                                    }}
                                >
                                    ← Back
                                </button>
                            )}

                            {isLastStep ? (
                                <button
                                    type="submit"
                                    form="onboarding-form"
                                    disabled={submitting}
                                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2"
                                    style={{
                                        background: submitting
                                            ? 'rgba(124,58,237,0.4)'
                                            : 'linear-gradient(135deg, #7c3aed 0%, #cc52b8 100%)',
                                        boxShadow: submitting ? 'none' : '0 8px 24px rgba(124,58,237,0.4)',
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting…
                                        </>
                                    ) : '🚀 Submit Application'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={next}
                                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all duration-200"
                                    style={{
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #cc52b8 100%)',
                                        boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
                                    }}
                                >
                                    Continue →
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideUpModal {
                    from { transform: translateY(100%); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @media (min-width: 640px) {
                    @keyframes slideUpModal {
                        from { transform: translateY(20px) scale(0.97); opacity: 0; }
                        to   { transform: translateY(0)    scale(1);    opacity: 1; }
                    }
                }
            `}</style>
        </div>
    );
}
