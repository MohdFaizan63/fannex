import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';

const GIFT_OPTIONS = [50, 100, 500, 1000, 5000, 10000];

/**
 * GiftPanel — bottom sheet showing gift amounts.
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
            // 1. Create order
            const { data } = await chatService.createGiftOrder(chatId, selected);
            const { order, keyId } = data;

            // 2. Open Razorpay
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

            // 3. Verify gift
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
                // User closed modal — no error
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
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-lg bg-[#0f0f1a] border border-white/10 rounded-t-3xl p-6 pb-10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Handle bar */}
                    <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

                    <h3 className="text-white font-bold text-lg text-center mb-1">Send a Gift 🎁</h3>
                    <p className="text-white/40 text-sm text-center mb-6">to {creatorName}</p>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {GIFT_OPTIONS.map((amt) => (
                            <button
                                key={amt}
                                onClick={() => setSelected(amt)}
                                className={`py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${selected === amt
                                    ? 'bg-gradient-to-br from-violet-600 to-pink-600 text-white scale-105 shadow-lg shadow-violet-500/30'
                                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                ₹{amt.toLocaleString('en-IN')}
                            </button>
                        ))}
                    </div>

                    {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

                    <button
                        onClick={handleSendGift}
                        disabled={!selected || loading}
                        className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-violet-600 to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-500 hover:to-pink-500 transition-all duration-200 text-base"
                    >
                        {loading ? 'Processing...' : selected ? `Send ₹${selected.toLocaleString('en-IN')} Gift` : 'Select an amount'}
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
