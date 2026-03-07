import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';
import './chat.css';

const GIFT_OPTIONS = [50, 100, 500, 1000, 5000, 10000];

/**
 * GiftPanel — Premium bottom-sheet with gift amount options.
 * Triggers Razorpay payment then posts confirmation.
 */
export default function GiftPanel({ chatId, creatorName, onGiftSent, onClose }) {
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendGift = async () => {
        if (!selected) return;
        setLoading(true);
        setError('');
        try {
            const { data } = await chatService.createGiftOrder(chatId, selected);
            const { order, keyId } = data;

            const result = await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                    key: keyId,
                    amount: order.amount,
                    currency: 'INR',
                    name: 'Fannex',
                    description: `Gift ₹${selected} to ${creatorName}`,
                    order_id: order.id,
                    theme: { color: '#7c3aed' },
                    handler: (res) => resolve(res),
                    modal: { ondismiss: () => reject(new Error('dismissed')) },
                });
                rzp.open();
            });

            const verifyRes = await chatService.verifyGift({
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
                chatId,
                amount: selected,
            });

            onGiftSent(verifyRes.data.data);
            onClose();
        } catch (err) {
            if (err.message === 'dismissed') {
                // User closed modal
            } else {
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    'Gift payment failed. Please try again.';
                setError(msg);
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
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    style={{
                        width: '100%', maxWidth: 480,
                        background: '#0a0a14',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '24px 24px 0 0',
                        padding: '16px 20px 28px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Handle bar */}
                    <div style={{
                        width: 40, height: 4, background: 'rgba(255,255,255,0.15)',
                        borderRadius: 999, margin: '0 auto 20px',
                    }} />

                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>
                        Send a Gift 🎁
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
                        to {creatorName}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                        {GIFT_OPTIONS.map((amt) => (
                            <motion.button
                                key={amt}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelected(amt)}
                                style={{
                                    padding: '14px 0',
                                    borderRadius: 16,
                                    fontWeight: 700,
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: selected === amt
                                        ? 'linear-gradient(135deg, #7c3aed, #cc52b8)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: selected === amt
                                        ? 'none'
                                        : '1px solid rgba(255,255,255,0.08)',
                                    color: selected === amt
                                        ? '#fff'
                                        : 'rgba(255,255,255,0.65)',
                                    boxShadow: selected === amt
                                        ? '0 4px 16px rgba(124,58,237,0.3)'
                                        : 'none',
                                    transform: selected === amt ? 'scale(1.03)' : 'scale(1)',
                                }}
                            >
                                ₹{amt.toLocaleString('en-IN')}
                            </motion.button>
                        ))}
                    </div>

                    {error && (
                        <div className="chat-alert chat-alert--error" style={{ marginBottom: 12 }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSendGift}
                        disabled={!selected || loading}
                        style={{
                            width: '100%',
                            padding: '15px 0',
                            borderRadius: 16,
                            fontWeight: 700,
                            fontSize: 15,
                            fontFamily: 'inherit',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            border: 'none',
                            cursor: !selected || loading ? 'not-allowed' : 'pointer',
                            opacity: !selected || loading ? 0.4 : 1,
                            transition: 'opacity 0.2s ease, transform 0.15s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? 'Processing…' : selected ? `Send ₹${selected.toLocaleString('en-IN')} Gift` : 'Select an amount'}
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
