import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRESETS = [100, 500, 1000, 2000];

export default function Wallet() {
    const navigate = useNavigate();
    const [balance, setBalance] = useState(null);
    const [selected, setSelected] = useState(null);
    const [customAmt, setCustomAmt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loadingBal, setLoadingBal] = useState(true);

    const finalAmount = selected ?? (customAmt ? Number(customAmt) : null);

    useEffect(() => {
        api.get('/payments/wallet-balance')
            .then(r => setBalance(r.data.data.walletBalance))
            .catch(() => setBalance(0))
            .finally(() => setLoadingBal(false));
    }, []);

    const handleRecharge = async () => {
        if (!finalAmount) { setError('Please select or enter an amount.'); return; }
        if (finalAmount < 10 || !Number.isInteger(finalAmount)) { setError('Minimum ₹10, whole numbers only.'); return; }
        if (!window.Razorpay) { setError('Payment system not loaded. Please refresh.'); return; }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/payments/wallet-order', { amount: finalAmount });
            const { order, keyId } = data.data;

            const result = await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                    key: keyId,
                    amount: order.amount,
                    currency: 'INR',
                    name: 'Fannex',
                    description: 'Wallet Recharge',
                    order_id: order.id,
                    theme: { color: '#7c3aed' },
                    handler: (res) => resolve(res),
                    modal: { ondismiss: () => reject(new Error('dismissed')) },
                });
                rzp.open();
            });

            const verifyRes = await api.post('/payments/wallet-verify', {
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
                amount: finalAmount,
            });

            const newBal = verifyRes.data.data.walletBalance;
            setBalance(newBal);
            setSuccess(`₹${finalAmount} added! New balance: ₹${newBal}`);
            setSelected(null);
            setCustomAmt('');
        } catch (err) {
            if (err.message === 'dismissed') { setLoading(false); return; }
            setError(err?.response?.data?.message || 'Recharge failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#07070f',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px',
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                    width: '100%',
                    maxWidth: 440,
                }}
            >
                {/* Back */}
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24,
                        padding: 0, transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                {/* Card */}
                <div style={{
                    background: '#0a0a14',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 24,
                    padding: '36px 28px 32px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                }}>
                    {/* Icon */}
                    <div style={{
                        width: 68, height: 68, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 18px',
                        boxShadow: '0 8px 28px rgba(124,58,237,0.35)',
                    }}>
                        <span style={{ fontSize: 30 }}>💳</span>
                    </div>

                    <h1 style={{
                        color: '#fff', fontWeight: 900, fontSize: 22,
                        textAlign: 'center', margin: '0 0 6px', letterSpacing: '-0.4px',
                    }}>
                        Top Up Wallet
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, textAlign: 'center', margin: '0 0 6px' }}>
                        Current balance
                    </p>
                    <div style={{
                        fontSize: 34, fontWeight: 900, color: '#fff', textAlign: 'center',
                        marginBottom: 28, letterSpacing: '-0.6px',
                    }}>
                        {loadingBal ? '…' : `₹${balance}`}
                    </div>

                    {/* Preset chips */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                        {PRESETS.map(p => (
                            <motion.button
                                key={p}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setSelected(p); setCustomAmt(''); setError(''); }}
                                style={{
                                    borderRadius: 14, height: 52,
                                    background: selected === p
                                        ? 'linear-gradient(135deg, #7c3aed, #cc52b8)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    color: selected === p ? '#fff' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                                    cursor: 'pointer', transition: 'all 0.15s ease',
                                    boxShadow: selected === p ? '0 4px 14px rgba(124,58,237,0.3)' : 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                ₹{p}
                            </motion.button>
                        ))}
                    </div>

                    {/* Custom input */}
                    <div style={{ position: 'relative', marginBottom: 22 }}>
                        <span style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: customAmt ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                            fontWeight: 700, fontSize: 16, pointerEvents: 'none',
                        }}>₹</span>
                        <input
                            type="number"
                            min={10}
                            placeholder="Custom amount (min ₹10)"
                            value={customAmt}
                            onChange={e => { setCustomAmt(e.target.value); setSelected(null); setError(''); }}
                            style={{
                                width: '100%', height: 48, boxSizing: 'border-box',
                                background: customAmt ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${customAmt ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 600,
                                fontFamily: 'inherit', paddingLeft: 30, paddingRight: 14,
                                outline: 'none', transition: 'all 0.2s ease',
                            }}
                        />
                    </div>

                    {/* Alerts */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                style={{
                                    color: '#f87171', fontSize: 13, marginBottom: 12,
                                    background: 'rgba(248,113,113,0.08)',
                                    border: '1px solid rgba(248,113,113,0.15)',
                                    borderRadius: 12, padding: '9px 14px',
                                }}
                            >
                                {error}
                            </motion.div>
                        )}
                        {success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                style={{
                                    color: '#4ade80', fontSize: 13, marginBottom: 12,
                                    background: 'rgba(74,222,128,0.08)',
                                    border: '1px solid rgba(74,222,128,0.15)',
                                    borderRadius: 12, padding: '9px 14px',
                                }}
                            >
                                ✅ {success}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Recharge button */}
                    <button
                        onClick={handleRecharge}
                        disabled={loading || !finalAmount}
                        style={{
                            width: '100%', height: 52, borderRadius: 16,
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                            opacity: loading || !finalAmount ? 0.4 : 1,
                            cursor: loading || !finalAmount ? 'not-allowed' : 'pointer',
                            border: 'none', transition: 'all 0.2s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? 'Processing…' : `Add ₹${finalAmount ?? '...'} to Wallet`}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
