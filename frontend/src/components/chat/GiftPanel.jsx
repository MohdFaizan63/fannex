import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';
import './chat.css';

const GIFT_OPTIONS = [50, 100, 500, 1000, 5000, 10000];

/**
 * GiftPanel — Cashfree gift payment via standard redirect.
 *
 * After payment Cashfree navigates to returnUrl (/subscription-success?order_id=gf_xxx)
 * which calls /chat/gift/verify to save the gift message and shows the success page.
 *
 * The Cashfree mode ('sandbox' | 'production') comes from the backend order response
 * (cfMode field), ensuring frontend always matches the backend environment.
 */
export default function GiftPanel({ chatId, creatorName, onGiftSent, onClose }) {
    const [selected, setSelected] = useState(null);
    const [customAmt, setCustomAmt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [phase, setPhase] = useState('select'); // 'select' | 'paying'

    const effectiveAmount = customAmt !== '' ? Number(customAmt) : selected;

    const handleCustomChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setCustomAmt(val);
        if (val) setSelected(null);
    };

    const handlePresetClick = (amt) => {
        setSelected(amt);
        setCustomAmt('');
    };

    // Clear stale gift sessionStorage (called on close/cancel — BUG-7 fix)
    const clearGiftSession = () => {
        sessionStorage.removeItem('fannex_gift_chat');
    };

    const handleSendGift = async () => {
        const amount = effectiveAmount;
        if (!amount || amount < 1) { setError('Please select or enter a gift amount (min ₹1).'); return; }

        setLoading(true);
        setError('');
        try {
            const { data } = await chatService.createGiftOrder(chatId, amount);
            const { order } = data;

            if (!order?.paymentSessionId) {
                throw new Error('Invalid order response from server');
            }

            // Store chatId + amount so the success page can call /chat/gift/verify
            // Always set fresh — clears any previous stale value (BUG-7)
            sessionStorage.setItem('fannex_gift_chat', JSON.stringify({
                chatId,
                amount,
                orderId: order.orderId,
            }));

            // Load Cashfree SDK (guard against duplicate script tags)
            if (!window.Cashfree) {
                const existing = document.querySelector('script[src*="cashfree"]');
                if (existing) {
                    await new Promise(r => { existing.addEventListener('load', r); setTimeout(r, 3000); });
                } else {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                        s.onload = resolve;
                        s.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
                        document.head.appendChild(s);
                    });
                }
            }

            // Use cfMode from the order response — always matches the backend environment.
            // This prevents the sandbox/production mismatch that causes payment_session_id_invalid.
            const cfMode = order.cfMode || 'production';
            const cashfree = window.Cashfree({ mode: cfMode });
            cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                returnUrl: `${window.location.origin}/subscription-success?order_id=${order.orderId}`,
                // No redirectTarget — use standard full-page redirect
            });

        } catch (err) {
            setPhase('select');
            if (err.message !== 'dismissed') {
                setError(
                    err?.response?.data?.message ||
                    err?.message ||
                    'Gift payment failed. Please try again.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
                onClick={() => { clearGiftSession(); onClose(); }}  // BUG-7: clear stale session on backdrop close
            >
                {/* ── Gift amount picker ──────────────────────────── */}
                <motion.div
                    key="picker"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    style={{
                        width: '100%', maxWidth: 480,
                        background: '#0a0a14',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '24px 24px 0 0',
                        padding: '16px 20px 32px',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Handle bar */}
                    <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 999, margin: '0 auto 20px' }} />

                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>
                        Send a Gift 🎁
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
                        to {creatorName}
                    </p>

                    {/* Preset grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                        {GIFT_OPTIONS.map(amt => (
                            <motion.button
                                key={amt}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePresetClick(amt)}
                                style={{
                                    padding: '14px 0', borderRadius: 16,
                                    fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: selected === amt ? 'linear-gradient(135deg, #7c3aed, #cc52b8)' : 'rgba(255,255,255,0.04)',
                                    border: selected === amt ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    color: selected === amt ? '#fff' : 'rgba(255,255,255,0.65)',
                                    boxShadow: selected === amt ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
                                    transform: selected === amt ? 'scale(1.03)' : 'scale(1)',
                                }}
                            >
                                ₹{amt.toLocaleString('en-IN')}
                            </motion.button>
                        ))}
                    </div>

                    {/* Custom amount */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: customAmt ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.03)',
                            border: customAmt ? '1.5px solid rgba(124,58,237,0.45)' : '1.5px solid rgba(255,255,255,0.08)',
                            borderRadius: 16, padding: '12px 16px', transition: 'all 0.2s ease',
                        }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>₹</span>
                            <input
                                type="text" inputMode="numeric"
                                placeholder="Custom amount…"
                                value={customAmt}
                                onChange={handleCustomChange}
                                style={{
                                    flex: 1, background: 'none', border: 'none', outline: 'none',
                                    color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'inherit',
                                }}
                            />
                            {customAmt && (
                                <button onClick={() => setCustomAmt('')}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                            )}
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 6, paddingLeft: 4 }}>
                            Min ₹1 · Max ₹10,000
                        </p>
                    </div>

                    {error && (
                        <div className="chat-alert chat-alert--error" style={{ marginBottom: 12 }}>{error}</div>
                    )}

                    <button
                        onClick={handleSendGift}
                        disabled={!effectiveAmount || effectiveAmount < 1 || loading}
                        style={{
                            width: '100%', padding: '15px 0', borderRadius: 16,
                            fontWeight: 700, fontSize: 15, fontFamily: 'inherit', color: '#fff',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            border: 'none',
                            cursor: !effectiveAmount || effectiveAmount < 1 || loading ? 'not-allowed' : 'pointer',
                            opacity: !effectiveAmount || effectiveAmount < 1 || loading ? 0.4 : 1,
                            transition: 'opacity 0.2s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? 'Opening payment…' : effectiveAmount
                            ? `Send ₹${Number(effectiveAmount).toLocaleString('en-IN')} Gift 🎁`
                            : 'Select or enter an amount'}
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
