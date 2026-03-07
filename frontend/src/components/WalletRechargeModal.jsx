import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const PRESETS = [100, 500, 1000, 2000];

/**
 * WalletRechargeModal — Premium wallet top-up modal.
 * Props: currentBalance, onClose, onRecharged(newBalance)
 */
export default function WalletRechargeModal({ currentBalance = 0, onClose, onRecharged }) {
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleRecharge = async () => {
        if (!selected) { setError('Please select an amount.'); return; }
        if (!window.Razorpay) { setError('Payment system not loaded. Please refresh.'); return; }

        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/payments/wallet-order', { amount: selected });
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
                amount: selected,
            });

            setSuccess(true);
            const newBal = verifyRes.data.data.walletBalance;
            onRecharged?.(newBal);
            setTimeout(() => onClose(), 1800);
        } catch (err) {
            if (err.message === 'dismissed') return;
            setError(err?.response?.data?.message || 'Recharge failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.88, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.88, opacity: 0 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                    style={{
                        background: '#0a0a14',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 24,
                        padding: '32px 28px 28px',
                        width: '100%',
                        maxWidth: 380,
                        textAlign: 'center',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
                    }}>
                        <span style={{ fontSize: 26 }}>💳</span>
                    </div>

                    <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                        Top Up Wallet
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 4px' }}>
                        Current balance
                    </p>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 24, letterSpacing: '-0.5px' }}>
                        ₹{currentBalance}
                    </div>

                    {/* Preset chips */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
                        {PRESETS.map((p) => (
                            <motion.button
                                key={p}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelected(p)}
                                style={{
                                    borderRadius: 14,
                                    height: 52,
                                    background: selected === p
                                        ? 'linear-gradient(135deg, #7c3aed, #cc52b8)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    color: selected === p ? '#fff' : 'rgba(255,255,255,0.65)',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: selected === p ? '0 4px 14px rgba(124,58,237,0.3)' : 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                ₹{p}
                            </motion.button>
                        ))}
                    </div>

                    {error && (
                        <div style={{
                            color: '#f87171', fontSize: 13, marginBottom: 12,
                            background: 'rgba(248,113,113,0.08)',
                            border: '1px solid rgba(248,113,113,0.15)',
                            borderRadius: 12, padding: '8px 12px',
                        }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{
                            color: '#4ade80', fontSize: 13, marginBottom: 12,
                            background: 'rgba(74,222,128,0.08)',
                            border: '1px solid rgba(74,222,128,0.15)',
                            borderRadius: 12, padding: '8px 12px',
                        }}>
                            ✅ Wallet recharged!
                        </div>
                    )}

                    <button
                        onClick={handleRecharge}
                        disabled={loading || !selected || success}
                        style={{
                            width: '100%',
                            height: 52,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 15,
                            fontFamily: 'inherit',
                            opacity: loading || !selected || success ? 0.4 : 1,
                            cursor: loading || !selected || success ? 'not-allowed' : 'pointer',
                            border: 'none',
                            marginBottom: 14,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? 'Processing…' : `Add ₹${selected ?? '...'} to Wallet`}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: 13,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                    >
                        Cancel
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
