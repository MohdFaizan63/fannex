import { useState } from 'react';
import api from '../services/api';

const PRESETS = [50, 100, 500, 1000];

/**
 * GiftModal — lets a fan send a gift to a creator via Razorpay.
 * Props: creatorId, creatorName, onClose, onSuccess
 */
export default function GiftModal({ creatorId, creatorName, onClose, onSuccess }) {
    const [selected, setSelected] = useState(null);
    const [custom, setCustom] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const amount = selected ?? (custom ? Number(custom) : null);

    const handleGift = async () => {
        if (!amount || amount < 1) { setError('Please select or enter an amount.'); return; }
        if (!window.Razorpay) { setError('Payment system not loaded. Please refresh.'); return; }

        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/payment/gift-order', { creatorId, amount });
            const { order, keyId } = data.data;

            const result = await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                    key: keyId,
                    amount: order.amount,
                    currency: 'INR',
                    name: 'Fannex',
                    description: `Gift to ${creatorName}`,
                    order_id: order.id,
                    theme: { color: '#ff7a18' },
                    handler: (res) => resolve(res),
                    modal: { ondismiss: () => reject(new Error('dismissed')) },
                });
                rzp.open();
            });

            await api.post('/payment/gift-verify', {
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
                creatorId,
                amount,
            });

            setSuccess(true);
            setTimeout(() => { onSuccess?.(); onClose(); }, 2000);
        } catch (err) {
            if (err.message === 'dismissed') return;
            setError(err?.response?.data?.message || 'Gift failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-3xl p-7 text-center shadow-2xl"
                style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                    style={{ background: 'linear-gradient(135deg,#ff7a18,#ffb347)', boxShadow: '0 8px 24px rgba(255,122,24,0.35)' }}
                >
                    <span className="text-2xl">🎁</span>
                </div>
                <h2 className="text-white font-black text-xl mb-1">Send a Gift</h2>
                <p className="text-white/40 text-sm mb-6">Show some love to {creatorName}</p>

                {/* Preset chips */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            onClick={() => { setSelected(p); setCustom(''); }}
                            style={{
                                borderRadius: 12,
                                height: 44,
                                background: selected === p ? 'linear-gradient(135deg,#ff7a18,#ffb347)' : 'rgba(255,255,255,0.05)',
                                border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                color: selected === p ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontWeight: 700,
                                fontSize: 13,
                                transition: 'all 0.15s ease',
                            }}
                        >
                            ₹{p}
                        </button>
                    ))}
                </div>

                {/* Custom amount */}
                <input
                    type="number"
                    placeholder="Custom amount (₹)"
                    value={custom}
                    onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
                    style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 12,
                        padding: '12px 16px',
                        color: '#fff',
                        fontSize: 14,
                        outline: 'none',
                        marginBottom: 16,
                    }}
                />

                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                {success && <p className="text-green-400 text-sm mb-3">🎉 Gift sent successfully!</p>}

                <button
                    onClick={handleGift}
                    disabled={loading || !amount || success}
                    style={{
                        width: '100%',
                        height: 52,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg,#ff7a18,#ffb347)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 15,
                        opacity: loading || !amount || success ? 0.5 : 1,
                        cursor: loading || !amount || success ? 'not-allowed' : 'pointer',
                        border: 'none',
                        transition: 'opacity 0.2s ease',
                        marginBottom: 12,
                    }}
                >
                    {loading ? 'Processing…' : `Send Gift${amount ? ` ₹${amount}` : ''}`}
                </button>

                <button
                    onClick={onClose}
                    style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
