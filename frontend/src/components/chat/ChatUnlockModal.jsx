import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';

/**
 * ChatUnlockModal — launched when user tries to open a chat they haven't paid for.
 * Creates Razorpay order, opens Razorpay checkout, verifies, calls onSuccess(chatId).
 */
export default function ChatUnlockModal({ creatorId, creatorName, chatPrice, onSuccess, onClose }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePay = async () => {
        setLoading(true);
        setError('');
        try {
            // Guard: Razorpay SDK must be loaded
            if (!window.Razorpay) {
                setError('Payment system not loaded. Please refresh the page.');
                setLoading(false);
                return;
            }

            // 1. Create Razorpay order
            const { data } = await chatService.createUnlockOrder(creatorId);

            if (data.alreadyUnlocked) {
                onSuccess(data.chatId);
                return;
            }

            const { order, keyId } = data;

            // 2. Open Razorpay checkout
            const result = await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                    key: keyId,
                    amount: order.amount,
                    currency: 'INR',
                    name: 'Fannex',
                    description: `Chat with ${creatorName}`,
                    order_id: order.id,
                    theme: { color: '#7c3aed' },
                    handler: (res) => resolve(res),
                    modal: { ondismiss: () => reject(new Error('dismissed')) },
                });
                rzp.open();
            });

            // 3. Verify & unlock
            const verifyRes = await chatService.verifyUnlock({
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
                creatorId,
            });

            onSuccess(verifyRes.data.chatId);
        } catch (err) {
            if (err.message === 'dismissed') {
                // User closed Razorpay modal — don't show error
            } else {
                // Show the actual backend error message when available
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
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.85, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="bg-[#0f0f1a] border border-white/10 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/30">
                        <span className="text-2xl">💬</span>
                    </div>

                    <h2 className="text-white font-black text-xl mb-2">Chat with {creatorName}</h2>
                    <p className="text-white/50 text-sm mb-6">
                        Unlock a private conversation for a one-time fee
                    </p>

                    {/* Price display */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                        <div className="text-3xl font-black text-white mb-1">₹{chatPrice}</div>
                        <div className="text-white/40 text-xs">one-time · chat forever</div>
                    </div>

                    {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                    <button
                        onClick={handlePay}
                        disabled={loading}
                        className="w-full py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-violet-500/30"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : `Unlock Chat — ₹${chatPrice}`}
                    </button>

                    <button
                        onClick={onClose}
                        className="mt-4 text-white/30 text-sm hover:text-white/60 transition-colors"
                    >
                        Cancel
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
