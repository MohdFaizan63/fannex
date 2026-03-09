import { useState } from 'react';
import api from '../services/api';

const PRESETS = [50, 100, 500, 1000, 2000, 5000];

/**
 * GiftModal — lets a fan send a gift to a creator via Cashfree.
 * Works for both subscribers and non-subscribers.
 * After payment, Cashfree redirect takes user to /subscription-success?order_id=gift_...
 * which shows a beautiful gift success screen.
 */
export default function GiftModal({ creatorId, creatorName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [custom, setCustom] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const amount = custom ? Number(custom) : selected;

    const handleGift = async () => {
        if (!amount || amount < 1) { setError('Minimum gift amount is ₹1.'); return; }
        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/payment/gift-order', { creatorId, amount });
            const order = data.data; // backend returns { success, data: { orderId, paymentSessionId, ... } }

            if (!order?.paymentSessionId) throw new Error('Invalid order from server');

            // Load Cashfree SDK
            if (!window.Cashfree) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            window.Cashfree({ mode: order.cfMode || 'production' }).checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_self',
            });
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Gift failed. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: 520,
                    background: 'linear-gradient(160deg, #0e0e1e, #12091f)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '28px 28px 0 0',
                    padding: '12px 20px 36px',
                    fontFamily: "'Inter', sans-serif",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 999, margin: '0 auto 22px' }} />

                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                        boxShadow: '0 8px 28px rgba(255,122,24,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, marginBottom: 14,
                    }}>🎁</div>
                    <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                        Send a Gift
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                        Show some love to <strong style={{ color: 'rgba(255,200,100,0.8)' }}>{creatorName}</strong>
                    </p>
                </div>

                {/* Preset grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            onClick={() => { setSelected(p); setCustom(''); }}
                            style={{
                                padding: '13px 0', borderRadius: 14,
                                fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                                background: selected === p
                                    ? 'linear-gradient(135deg, #ff7a18, #ffb347)'
                                    : 'rgba(255,255,255,0.04)',
                                border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                color: selected === p ? '#fff' : 'rgba(255,255,255,0.65)',
                                boxShadow: selected === p ? '0 4px 16px rgba(255,122,24,0.35)' : 'none',
                                transform: selected === p ? 'scale(1.04)' : 'scale(1)',
                            }}
                        >
                            ₹{p.toLocaleString('en-IN')}
                        </button>
                    ))}
                </div>

                {/* Custom amount */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: custom ? 'rgba(255,122,24,0.07)' : 'rgba(255,255,255,0.03)',
                    border: custom ? '1.5px solid rgba(255,122,24,0.4)' : '1.5px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '12px 16px', marginBottom: 8,
                    transition: 'all 0.2s ease',
                }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: 700 }}>₹</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Custom amount…"
                        value={custom}
                        onChange={e => { setCustom(e.target.value.replace(/[^0-9]/g, '')); setSelected(null); }}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' }}
                    />
                    {custom && (
                        <button onClick={() => setCustom('')}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 15, padding: 0 }}>✕</button>
                    )}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginBottom: 18, paddingLeft: 4 }}>Min ₹1 · Max ₹10,000</p>

                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 12, marginBottom: 14,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#fca5a5', fontSize: 13,
                    }}>{error}</div>
                )}

                <button
                    onClick={handleGift}
                    disabled={!amount || amount < 0.1 || loading}
                    style={{
                        width: '100%', padding: '15px 0', borderRadius: 999, border: 'none',
                        background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                        boxShadow: '0 6px 20px rgba(255,122,24,0.4)',
                        color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                        cursor: !amount || amount < 0.1 || loading ? 'not-allowed' : 'pointer',
                        opacity: !amount || amount < 1 || loading ? 0.45 : 1,
                        transition: 'opacity 0.2s ease, transform 0.15s ease',
                        letterSpacing: '-0.01em',
                    }}
                    onMouseEnter={e => { if (amount && amount >= 1 && !loading) e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                    {loading ? 'Processing…' : amount ? `Send ₹${Number(amount).toLocaleString('en-IN')} Gift 🎁` : 'Select an amount'}
                </button>

                <button
                    onClick={onClose}
                    style={{ marginTop: 14, display: 'block', width: '100%', color: 'rgba(255,255,255,0.3)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
