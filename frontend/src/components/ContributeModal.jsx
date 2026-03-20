import { useState } from 'react';
import dreamFundService from '../services/dreamFundService';

// ── Cashfree JS SDK v3 loader ─────────────────────────────────────────────────
// Cashfree v2 (cashfree.prod.js) is deprecated and has a different API.
// v3 uses @cashfreepayments/cashfree-js — loaded dynamically from CDN.
let cfLoadPromise = null;

async function loadCashfreeSDK() {
    if (cfLoadPromise) return cfLoadPromise;
    cfLoadPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.Cashfree && typeof window.Cashfree === 'function') {
            resolve(window.Cashfree);
            return;
        }
        const script = document.createElement('script');
        // Cashfree JS SDK v3 — the only officially supported CDN build
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => {
            if (window.Cashfree) resolve(window.Cashfree);
            else reject(new Error('Cashfree SDK did not initialise after load'));
        };
        script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
        document.head.appendChild(script);
    });
    return cfLoadPromise;
}

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2000];

export default function ContributeModal({ goal, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const baseAmount = Number(amount) || 0;
    const gstAmount = +(baseAmount * 0.18).toFixed(2);
    const totalPaid = +(baseAmount + gstAmount).toFixed(2);

    const handleContribute = async () => {
        setError('');
        if (!baseAmount || baseAmount < 1) {
            setError('Please enter a valid amount (minimum ₹1)');
            return;
        }
        setLoading(true);
        try {
            // Step 1: Create order on backend
            const { data: apiRes } = await dreamFundService.createContributionOrder({
                goalId: goal._id,
                amount: baseAmount,
                message,
                isAnonymous,
            });

            if (!apiRes.success || !apiRes.data) {
                throw new Error(apiRes.message || 'Failed to create payment order');
            }

            const { paymentSessionId, cfMode, orderId } = apiRes.data;

            if (!paymentSessionId) {
                throw new Error('Payment session not received from server');
            }

            // Step 2: Load Cashfree SDK v3
            const CashfreeConstructor = await loadCashfreeSDK();

            // SDK v3: initialise with mode
            const cashfree = await CashfreeConstructor({
                mode: cfMode === 'sandbox' ? 'sandbox' : 'production',
            });

            // Step 3: Open Cashfree checkout in modal
            const paymentResult = await cashfree.checkout({
                paymentSessionId,
                redirectTarget: '_modal',
            });

            // paymentResult shape: { error: null | { message, code }, redirect: true|false }
            if (paymentResult?.error) {
                const errMsg = paymentResult.error?.message || 'Payment was cancelled or failed';
                setError(errMsg);
                setLoading(false);
                return;
            }

            // Step 4: Verify with backend — the modal flow completes synchronously here
            const verifyRes = await dreamFundService.verifyContribution({
                orderId,
                goalId: goal._id,
            });

            onSuccess(verifyRes.data);
        } catch (err) {
            // Show backend message if available, otherwise generic message
            const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
            setError(msg);
            // Reset promise so next attempt re-loads SDK if it failed to load
            if (err?.message?.includes('Cashfree')) cfLoadPromise = null;
        } finally {
            setLoading(false);
        }
    };

    const remaining = goal.targetAmount - goal.currentAmount;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                padding: 16,
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div style={{
                background: 'linear-gradient(145deg, #1a0b2e, #0d0718)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 24,
                padding: '24px 20px',
                width: '100%',
                maxWidth: 420,
                boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
                maxHeight: '92vh',
                overflowY: 'auto',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 19, margin: 0, letterSpacing: '-0.03em' }}>
                            💎 Contribute
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '3px 0 0' }}>
                            {goal.title}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 16,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >✕</button>
                </div>

                {/* Remaining hint */}
                {remaining > 0 && (
                    <div style={{
                        background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                        borderRadius: 12, padding: '9px 14px', marginBottom: 18,
                        color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600,
                    }}>
                        🔥 Only <strong style={{ color: '#a855f7' }}>₹{remaining.toLocaleString('en-IN')}</strong> more needed to complete this goal!
                    </div>
                )}

                {/* Quick-select chips */}
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Quick Select
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {QUICK_AMOUNTS.map((amt) => (
                        <button
                            key={amt}
                            onClick={() => setAmount(String(amt))}
                            style={{
                                padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                background: Number(amount) === amt
                                    ? 'linear-gradient(135deg, #9333ea, #ec4899)'
                                    : 'rgba(255,255,255,0.06)',
                                border: Number(amount) === amt
                                    ? '1px solid transparent'
                                    : '1px solid rgba(255,255,255,0.12)',
                                color: '#fff',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            ₹{amt.toLocaleString('en-IN')}
                        </button>
                    ))}
                </div>

                {/* Amount input */}
                <div style={{ marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Custom Amount (₹)
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={100000}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount in ₹"
                        style={{
                            width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 16, fontWeight: 700,
                            background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
                            color: '#fff', outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    />
                </div>

                {/* Message */}
                <div style={{ marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Message (optional)
                    </p>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Leave a message of support..."
                        maxLength={300}
                        rows={2}
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: 14, fontSize: 14, resize: 'none',
                            background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
                            color: '#fff', outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                    />
                </div>

                {/* Anonymous toggle */}
                <label style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 18,
                    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
                }}>
                    <div
                        onClick={() => setIsAnonymous(!isAnonymous)}
                        style={{
                            width: 40, height: 22, borderRadius: 999,
                            background: isAnonymous ? 'linear-gradient(135deg, #9333ea, #ec4899)' : 'rgba(255,255,255,0.15)',
                            position: 'relative', transition: 'background 0.2s ease', cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            position: 'absolute', top: 3, left: isAnonymous ? 21 : 3, width: 16, height: 16,
                            borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease',
                        }} />
                    </div>
                    Contribute anonymously
                </label>

                {/* GST breakdown */}
                {baseAmount > 0 && (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                        fontSize: 12, color: 'rgba(255,255,255,0.6)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>Contribution</span>
                            <span>₹{baseAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>GST (18%)</span>
                            <span>₹{gstAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 6, color: '#fff', fontWeight: 700, fontSize: 14 }}>
                            <span>Total</span>
                            <span>₹{totalPaid.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                        borderRadius: 12, padding: '10px 14px', marginBottom: 14,
                    }}>
                        <p style={{ color: '#f87171', fontSize: 13, fontWeight: 600, margin: 0, textAlign: 'center' }}>
                            ⚠️ {error}
                        </p>
                    </div>
                )}

                {/* CTA */}
                <button
                    onClick={handleContribute}
                    disabled={loading || !baseAmount}
                    style={{
                        width: '100%', height: 52, borderRadius: 16, border: 'none',
                        background: loading || !baseAmount
                            ? 'rgba(255,255,255,0.08)'
                            : 'linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #f97316 100%)',
                        color: loading || !baseAmount ? 'rgba(255,255,255,0.3)' : '#fff',
                        fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em',
                        cursor: loading || !baseAmount ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                    onMouseEnter={(e) => { if (!loading && baseAmount) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(168,85,247,0.5)'; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                            Processing…
                            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                        </span>
                    ) : baseAmount ? `💎 Contribute ₹${baseAmount.toLocaleString('en-IN')}` : 'Enter an amount to contribute'}
                </button>

                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                    Secured by Cashfree · 18% GST applied
                </p>
            </div>
        </div>
    );
}
