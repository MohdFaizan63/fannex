import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';
import './chat.css';

/**
 * ChatUnlockModal — Premium unlock modal with payment flow.
 * Creates Cashfree order, opens Cashfree checkout, redirects to success page.
 */
export default function ChatUnlockModal({ creatorId, creatorName, chatPrice, onSuccess, onClose }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePay = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await chatService.createUnlockOrder(creatorId);

            if (data.alreadyUnlocked) {
                onSuccess(data.chatId);
                return;
            }

            const { order } = data;

            if (!order?.paymentSessionId) {
                throw new Error('Invalid order response from server');
            }

            // Load Cashfree.js SDK dynamically
            if (!window.Cashfree) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const cashfree = window.Cashfree({ mode: 'production' });
            cashfree.checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_self',
            });
            // After redirect back, SubscriptionSuccess page will handle verification
        } catch (err) {
            if (err.message !== 'dismissed') {
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    'Payment failed. Please try again.';
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
                        padding: '36px 28px 28px',
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
                        margin: '0 auto 20px',
                        boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
                    }}>
                        <span style={{ fontSize: 26 }}>💬</span>
                    </div>

                    <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                        Chat with {creatorName}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
                        Unlock a private conversation for a one-time fee
                    </p>

                    {/* Price display */}
                    <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 18,
                        padding: '20px 16px',
                        marginBottom: 24,
                    }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                            ₹{chatPrice}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                            one-time • chat forever
                        </div>
                    </div>

                    {error && (
                        <div className="chat-alert chat-alert--error" style={{ marginBottom: 16 }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handlePay}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '16px 0',
                            borderRadius: 16,
                            fontWeight: 700,
                            fontSize: 15,
                            fontFamily: 'inherit',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                        }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span className="chat-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                Processing…
                            </span>
                        ) : `Unlock Chat — ₹${chatPrice}`}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            marginTop: 16,
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
