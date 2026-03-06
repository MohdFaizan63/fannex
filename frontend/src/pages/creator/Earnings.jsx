import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import payoutService from '../../services/payoutService';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';

// ── Payout Request Modal ──────────────────────────────────────────────────────
function PayoutModal({ maxAmount, onClose, onSuccess }) {
    const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
    const overlayRef = useRef();

    const onSubmit = async ({ amount }) => {
        const num = parseFloat(amount);
        try {
            await payoutService.requestPayout(num);
            onSuccess();
        } catch (err) {
            setError('amount', { message: getErrorMessage(err) });
        }
    };

    return (
        <div
            ref={overlayRef}
            onClick={(e) => e.target === overlayRef.current && onClose()}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        >
            <div className="glass rounded-2xl p-7 w-full max-w-sm border border-white/10 animate-fade-in-up">
                <h3 className="text-xl font-bold text-white mb-1">Request Payout</h3>
                <p className="text-sm text-surface-400 mb-6">
                    Available balance: <span className="text-brand-400 font-semibold">{formatCurrency(maxAmount)}</span>
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Amount (₹)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-semibold">₹</span>
                            <input
                                type="number"
                                step="0.01"
                                min="1"
                                max={maxAmount}
                                placeholder="0.00"
                                className="input-dark pl-7 w-full"
                                {...register('amount', {
                                    required: 'Enter an amount',
                                    min: { value: 1, message: 'Minimum ₹1' },
                                    max: { value: maxAmount, message: `Max ${formatCurrency(maxAmount)}` },
                                    validate: (v) => !isNaN(parseFloat(v)) || 'Enter a valid number',
                                })}
                            />
                        </div>
                        {errors.amount && (
                            <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>
                        )}
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose} className="btn-outline flex-1 py-2.5">Cancel</button>
                        <button type="submit" disabled={isSubmitting || maxAmount <= 0}
                            className="btn-brand flex-1 py-2.5 disabled:opacity-50">
                            {isSubmitting ? 'Sending…' : 'Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Status pill ───────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
    paid: 'bg-green-500/20  text-green-400  border-green-500/30',
    rejected: 'bg-red-500/20   text-red-400    border-red-500/30',
};

function StatusPill({ status }) {
    return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLES[status] ?? 'bg-surface-700 text-surface-400'}`}>
            {status}
        </span>
    );
}

// ── Main Earnings Page ────────────────────────────────────────────────────────
export default function Earnings() {
    const [earnings, setEarnings] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [eRes, pRes] = await Promise.allSettled([
                payoutService.getEarnings(),
                payoutService.listMyPayouts({ limit: 50, sort: '-requestedAt' }),
            ]);
            if (eRes.status === 'fulfilled') setEarnings(eRes.value.data?.data ?? eRes.value.data);
            if (pRes.status === 'fulfilled') setPayouts(pRes.value.data?.results ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handlePayoutSuccess = () => {
        setShowModal(false);
        setSuccessMsg("Payout request submitted! We'll process it within 2 business days.");
        loadData();
        setTimeout(() => setSuccessMsg(''), 6000);
    };

    const cards = [
        { icon: '💰', label: 'Total Earned', value: earnings?.totalEarned ?? 0, accent: true },
        { icon: '⏳', label: 'Pending Balance', value: earnings?.pendingAmount ?? 0, accent: false },
        { icon: '✅', label: 'Withdrawn', value: earnings?.withdrawnAmount ?? 0, accent: false },
    ];

    return (
        <div className="p-6 max-w-5xl">

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">Earnings</h1>
                    <p className="text-surface-400 mt-1">Track your income and request payouts.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!earnings || earnings.pendingAmount <= 0}
                    className="btn-brand px-7 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    💸 Request Payout
                </button>
            </div>

            {/* Success message */}
            {successMsg && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    {successMsg}
                </div>
            )}

            {/* ── Stat cards ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {cards.map((c) => (
                    loading
                        ? <div key={c.label} className="glass rounded-2xl p-5 border border-white/5 animate-pulse">
                            <div className="skeleton w-8 h-8 rounded-lg mb-3" />
                            <div className="skeleton h-7 w-24 mb-2" />
                            <div className="skeleton h-3 w-16" />
                        </div>
                        : (
                            <div key={c.label} className={`glass rounded-2xl p-5 border transition-all hover:-translate-y-0.5 ${c.accent ? 'border-brand-500/30' : 'border-white/5'
                                }`}>
                                <span className="text-2xl block mb-3">{c.icon}</span>
                                <p className={`text-2xl font-black mb-1 ${c.accent ? 'gradient-text' : 'text-white'}`}>
                                    {formatCurrency(c.value)}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-surface-500 font-medium">{c.label}</p>
                            </div>
                        )
                ))}
            </div>

            {/* ── Payout history table ─────────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="font-bold text-white">Payout History</h2>
                    <span className="text-xs text-surface-500">{payouts.length} request{payouts.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div className="divide-y divide-white/5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="px-5 py-4 flex items-center gap-4">
                                <div className="skeleton h-4 w-24" />
                                <div className="skeleton h-4 w-16 ml-auto" />
                                <div className="skeleton h-6 w-20 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : payouts.length === 0 ? (
                    <div className="text-center py-12 text-surface-500">
                        <div className="text-4xl mb-3">📭</div>
                        <p>No payout requests yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">Date</th>
                                    <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">Amount</th>
                                    <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">Status</th>
                                    <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">Processed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payouts.map((p) => (
                                    <tr key={p._id} className="hover:bg-white/2 transition-colors">
                                        <td className="px-5 py-4 text-surface-300">
                                            {formatDate(p.requestedAt ?? p.createdAt)}
                                        </td>
                                        <td className="px-5 py-4 font-semibold text-white">
                                            {formatCurrency(p.amount)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <StatusPill status={p.status} />
                                        </td>
                                        <td className="px-5 py-4 text-surface-500">
                                            {p.processedAt ? formatDate(p.processedAt) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <PayoutModal
                    maxAmount={earnings?.pendingAmount ?? 0}
                    onClose={() => setShowModal(false)}
                    onSuccess={handlePayoutSuccess}
                />
            )}
        </div>
    );
}
