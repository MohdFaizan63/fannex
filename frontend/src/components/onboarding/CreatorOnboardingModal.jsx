import { useState, useEffect, useCallback } from 'react';
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

    const {
        register, handleSubmit, watch, setValue, setError, clearErrors, trigger,
        formState: { errors },
    } = useForm({ mode: 'onChange' });

    // Lock body scroll when modal open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Reset state when closed
    const handleClose = useCallback(() => {
        setStep(0);
        setSubmitError('');
        onClose();
    }, [onClose]);

    // Validate current step fields before advancing
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

    // Final submit
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
            // KYC fields
            fd.append('fullName', data.fullName);
            fd.append('panNumber', data.panNumber);
            fd.append('aadhaarNumber', data.aadhaarNumber);
            fd.append('bankAccountNumber', data.bankAccountNumber);
            fd.append('ifscCode', data.ifscCode);
            // Files
            if (data.aadhaarImage) fd.append('aadhaarImage', data.aadhaarImage);
            if (data.panImage) fd.append('panImage', data.panImage);
            if (data.bankProofImage) fd.append('bankProofImage', data.bankProofImage);

            await applyForCreator(fd);
            // Refresh user immediately so creatorApplicationStatus → 'pending',
            // which starts the auto-poll in AuthContext until admin approves.
            try { await refreshUser(); } catch (_) { /* non-critical */ }
            setStep(5); // success screen
            if (onSuccess) onSuccess();
        } catch (err) {
            setSubmitError(err?.response?.data?.message || 'Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isLastStep = step === TOTAL_STEPS - 2; // step 4 = verification (before success)
    const isSuccess = step === TOTAL_STEPS - 1;

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-xl max-h-[90vh] glass rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
                    <div>
                        <h1 className="text-lg font-black text-white">Become a Creator</h1>
                        <p className="text-xs text-surface-500">Join thousands earning on Fannex</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress bar */}
                {!isSuccess && (
                    <div className="px-6 pt-4 flex-shrink-0">
                        <StepProgress current={step} />
                    </div>
                )}

                {/* Step content — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-2">
                    <form id="onboarding-form" onSubmit={handleSubmit(onSubmit)}>
                        {step === 0 && <CountryStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 1 && <CreatorTypeStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 2 && <CreatorProfileStep register={register} errors={errors} watch={watch} setValue={setValue} setError={setError} clearErrors={clearErrors} />}
                        {step === 3 && <SubscriptionPriceStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 4 && <IdentityVerificationStep register={register} errors={errors} watch={watch} setValue={setValue} />}
                        {step === 5 && <SuccessStep onClose={handleClose} />}
                    </form>
                </div>

                {/* Footer nav */}
                {!isSuccess && (
                    <div className="px-6 py-4 border-t border-white/5 flex items-center gap-3 flex-shrink-0">
                        {/* Error */}
                        {submitError && (
                            <p className="flex-1 text-xs text-red-400">{submitError}</p>
                        )}

                        <div className="flex gap-3 ml-auto">
                            {step > 0 && (
                                <button type="button" onClick={back} className="btn-outline px-5 py-2.5 text-sm">
                                    ← Back
                                </button>
                            )}

                            {isLastStep ? (
                                <button
                                    type="submit"
                                    form="onboarding-form"
                                    disabled={submitting}
                                    className="btn-brand px-5 py-2.5 text-sm"
                                >
                                    {submitting
                                        ? <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting…
                                        </span>
                                        : '🚀 Submit Application'}
                                </button>
                            ) : (
                                <button type="button" onClick={next} className="btn-brand px-5 py-2.5 text-sm">
                                    Next →
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
