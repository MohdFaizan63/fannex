import { useState, useRef, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { formatCurrency, getErrorMessage } from '../../utils/helpers';

// ── PayNowModal ───────────────────────────────────────────────────────────────
/**
 * Confirmation modal for admin-initiated direct payout.
 * - Disables button on first click (anti-double-click)
 * - Shows success state with payout ID on completion
 * - Shows inline error on failure (button re-enables)
 */
export default function PayNowModal({ creatorId, creatorName, pendingAmount, bankDetails, onClose, onSuccess }) {
    const [phase, setPhase] = useState('confirm'); // 'confirm' | 'processing' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [payout, setPayout] = useState(null);
    const overlayRef = useRef();

    // Close on Escape
    useEffect(() => {
        const h = (e) => e.key === 'Escape' && phase !== 'processing' && onClose();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose, phase]);

    const handleConfirm = async () => {
        if (phase === 'processing') return; // hard guard against double-click
        setPhase('processing');
        setErrorMsg('');
        try {
            const res = await adminService.directPayout(creatorId);
            const payoutData = res.data?.data ?? {};
            setPayout(payoutData);
            setPhase('success');
        } catch (err) {
            setErrorMsg(getErrorMessage(err));
            setPhase('error');
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === overlayRef.current && phase !== 'processing') onClose();
    };

    return (
        <div
            ref={overlayRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md px-4"
        >
            <div
                className="glass rounded-2xl border border-white/10 shadow-2xl w-full max-w-md p-6"
                style={{ animation: 'fadeInScale 0.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
            >

                {/* ── Confirm Phase ──────────────────────────────────────── */}
                {(phase === 'confirm' || phase === 'error' || phase === 'processing') && (
                    <>
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Confirm Payout</h3>
                                <p className="text-xs text-surface-500">This action cannot be undone</p>
                            </div>
                        </div>

                        {/* Amount highlight */}
                        <div
                            className="rounded-xl p-4 mb-4 text-center"
                            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(168,85,247,0.06))', border: '1px solid rgba(124,58,237,0.2)' }}
                        >
                            <p className="text-xs uppercase tracking-widest text-surface-500 mb-1">Amount to Pay</p>
                            <p className="text-3xl font-black gradient-text">{formatCurrency(pendingAmount)}</p>
                            <p className="text-sm text-surface-400 mt-1">to <span className="text-white font-semibold">{creatorName}</span></p>
                        </div>

                        {/* Bank details summary */}
                        {bankDetails && (
                            <div className="rounded-xl p-3 mb-5 space-y-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-surface-500 w-28 flex-shrink-0">Bank</span>
                                    <span className="text-sm text-white font-medium">{bankDetails.bankName || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-surface-500 w-28 flex-shrink-0">Account</span>
                                    <span className="text-sm text-white font-medium font-mono">
                                        ••••{bankDetails.last4 || '????'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-surface-500 w-28 flex-shrink-0">IFSC</span>
                                    <span className="text-sm text-white font-medium">{bankDetails.ifscCode || '—'}</span>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {phase === 'error' && errorMsg && (
                            <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                                <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {errorMsg}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={phase === 'processing'}
                                className="btn-outline flex-1 h-11 disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={phase === 'processing'}
                                className="btn-brand flex-1 h-11 font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {phase === 'processing' ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing…
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Confirm Payout
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* ── Success Phase ──────────────────────────────────────── */}
                {phase === 'success' && (
                    <div className="text-center py-4">
                        {/* Animated checkmark */}
                        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
                            style={{ animation: 'popIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                            <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-black text-white mb-1">Payment Successful! 🎉</h3>
                        <p className="text-surface-400 text-sm mb-4">
                            <span className="text-emerald-400 font-bold">{formatCurrency(pendingAmount)}</span> has been paid to <span className="text-white font-semibold">{creatorName}</span>.
                        </p>

                        {payout?._id && (
                            <div className="rounded-xl py-2.5 px-4 mb-5 inline-block" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-xs text-surface-500 mb-0.5">Transaction ID</p>
                                <p className="text-xs font-mono text-surface-300 break-all">{payout._id}</p>
                            </div>
                        )}

                        <button
                            onClick={() => onSuccess(payout ?? {})}
                            className="btn-brand w-full h-11 font-bold"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to   { opacity: 1; transform: scale(1)    translateY(0); }
                }
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.5); }
                    to   { opacity: 1; transform: scale(1);   }
                }
            `}</style>
        </div>
    );
}
