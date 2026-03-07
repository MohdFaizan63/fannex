import { useState } from 'react';
import api from '../services/api';

const PRESETS = [100, 500, 1000, 2000];

/**
 * WalletRechargeModal — lets a user top up their chat wallet.
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
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#cc52b8)', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}
                >
                    <span className="text-2xl">💳</span>
                </div>

                <h2 className="text-white font-black text-xl mb-1">Top Up Wallet</h2>
                <p className="text-white/40 text-sm mb-1">Current balance</p>
                <div className="text-2xl font-black text-white mb-5">₹{currentBalance}</div>

                {/* Preset chips */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            onClick={() => setSelected(p)}
                            style={{
                                borderRadius: 12,
                                height: 52,
                                background: selected === p
                                    ? 'linear-gradient(135deg,#7c3aed,#cc52b8)'
                                    : 'rgba(255,255,255,0.05)',
                                border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                color: selected === p ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontWeight: 700,
                                fontSize: 13,
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                            }}
                        >
                            <span>₹{p}</span>
                        </button>
                    ))}
                </div>

                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                {success && <p className="text-green-400 text-sm mb-3">✅ Wallet recharged!</p>}

                <button
                    onClick={handleRecharge}
                    disabled={loading || !selected || success}
                    style={{
                        width: '100%',
                        height: 52,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg,#7c3aed,#cc52b8)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 15,
                        opacity: loading || !selected || success ? 0.5 : 1,
                        cursor: loading || !selected || success ? 'not-allowed' : 'pointer',
                        border: 'none',
                        marginBottom: 12,
                    }}
                >
                    {loading ? 'Processing…' : `Add ₹${selected ?? '...'} to Wallet`}
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
