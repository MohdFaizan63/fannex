import { useState } from 'react';
import dreamFundService from '../services/dreamFundService';

// ── Cashfree SDK loader ───────────────────────────────────────────────────────
let cfPromise = null;
function loadCashfree() {
    if (cfPromise) return cfPromise;
    cfPromise = new Promise((resolve, reject) => {
        if (window.Cashfree) { resolve(window.Cashfree); return; }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.prod.js';
        script.onload = () => resolve(window.Cashfree);
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return cfPromise;
}

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2000];

export default function ContributeModal({ goal, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [gst, setGst] = useState(null);

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
            const { data } = await dreamFundService.createContributionOrder({
                goalId: goal._id,
                amount: baseAmount,
                message,
                isAnonymous,
            });

            const orderData = data.data;
            const cf = await loadCashfree();
            const cashfree = cf({ mode: orderData.cfMode || 'production' });

            const paymentResult = await cashfree.checkout({
                paymentSessionId: orderData.paymentSessionId,
                redirectTarget: '_modal',
            });

            if (paymentResult.error) {
                setError(paymentResult.error.message || 'Payment failed');
                setLoading(false);
                return;
            }

            // Verify
            const verify = await dreamFundService.verifyContribution({
                orderId: orderData.orderId,
                goalId: goal._id,
            });

            onSuccess(verify.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
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
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                padding: 16,
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div style={{
                background: 'linear-gradient(145deg, #1a0b2e, #0d0718)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 24,
                padding: 28,
                width: '100%',
                maxWidth: 440,
                boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: 0, letterSpacing: '-0.03em' }}>
                            💎 Contribute
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>
                            {goal.title}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 16,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >✕</button>
                </div>

                {/* Remaining hint */}
                {remaining > 0 && (
                    <div style={{
                        background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                        borderRadius: 12, padding: '10px 14px', marginBottom: 20,
                        color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600,
                    }}>
                        🔥 Only <strong style={{ color: '#a855f7' }}>₹{remaining.toLocaleString('en-IN')}</strong> more needed to complete this goal!
                    </div>
                )}

                {/* Quick-select chips */}
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Quick Select
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {QUICK_AMOUNTS.map((amt) => (
                        <button
                            key={amt}
                            onClick={() => setAmount(String(amt))}
                            style={{
                                padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20,
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
                        borderRadius: 12, padding: '12px 14px', marginBottom: 18,
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
                    <p style={{ color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
                        ⚠️ {error}
                    </p>
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
                    {loading ? 'Processing…' : baseAmount ? `💎 Contribute ₹${baseAmount.toLocaleString('en-IN')}` : 'Enter an amount to contribute'}
                </button>

                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                    Secured by Cashfree · 18% GST applied
                </p>
            </div>
        </div>
    );
}
