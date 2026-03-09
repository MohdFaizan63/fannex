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
    const [customAmt, setCustomAmt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const finalAmount = selected ?? (customAmt ? Number(customAmt) : null);

    const handleRecharge = async () => {
        if (!finalAmount) { setError('Please select or enter an amount.'); return; }
        if (finalAmount < 0.1) { setError('Minimum recharge is ₹0.1.'); return; }
        if (finalAmount > 50000) { setError('Maximum recharge is ₹50,000.'); return; }

        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/payment/wallet-order', { amount: finalAmount });
            const order = data.data; // { orderId, paymentSessionId, amount, ... }

            if (!order?.paymentSessionId) {
                throw new Error('Invalid order response from server. Please try again.');
            }

            // Load Cashfree SDK dynamically (guard against duplicate script tags)
            if (!window.Cashfree) {
                const existingScript = document.querySelector('script[src*="cashfree"]');
                if (existingScript) {
                    await new Promise(r => { existingScript.addEventListener('load', r); setTimeout(r, 3000); });
                } else {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                        script.onload = resolve;
                        script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
                        document.head.appendChild(script);
                    });
                }
            }

            // Store wallet recharge metadata so verify endpoint knows to credit wallet
            sessionStorage.setItem('fannex_wallet_recharge', JSON.stringify({
                orderId: order.orderId,
                amount: finalAmount,
            }));

            // Redirect to Cashfree checkout — same pattern as gift/subscription
            const cashfree = window.Cashfree({ mode: 'production' });
            cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_self',
            });

        } catch (err) {
            if (err.message !== 'dismissed') {
                setError(err?.response?.data?.message || err?.message || 'Recharge failed. Please try again.');
            }
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                        {PRESETS.map((p) => (
                            <motion.button
                                key={p}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setSelected(p); setCustomAmt(''); }}
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

                    {/* Custom amount */}
                    <div style={{ position: 'relative', marginBottom: 20 }}>
                        <span style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: customAmt ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                            fontWeight: 700, fontSize: 16, pointerEvents: 'none',
                        }}>₹</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            placeholder="Custom amount (min ₹1)"
                            value={customAmt}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') { setCustomAmt(''); }
                                else {
                                    const n = parseFloat(val);
                                    if (!isNaN(n) && n >= 0) setCustomAmt(val);
                                }
                                setSelected(null);
                            }}
                            style={{
                                width: '100%',
                                height: 48,
                                background: customAmt ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${customAmt ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 14,
                                color: '#fff',
                                fontSize: 15,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                paddingLeft: 30,
                                paddingRight: 14,
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box',
                            }}
                        />
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


                    <button
                        onClick={handleRecharge}
                        disabled={loading || !finalAmount}
                        style={{
                            width: '100%',
                            height: 52,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 15,
                            fontFamily: 'inherit',
                            opacity: loading || !finalAmount ? 0.4 : 1,
                            cursor: loading || !finalAmount ? 'not-allowed' : 'pointer',
                            border: 'none',
                            marginBottom: 14,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? 'Processing…' : `Add ₹${finalAmount ?? '...'} to Wallet`}
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
