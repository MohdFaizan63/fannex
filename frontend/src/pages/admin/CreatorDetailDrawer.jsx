import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import PayNowModal from './PayNowModal';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

// ── Status Pills ──────────────────────────────────────────────────────────────
const PAYOUT_STYLES = {
    pending:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    approved: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    paid:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
};
function StatusPill({ status }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${PAYOUT_STYLES[status] ?? 'bg-surface-700 text-surface-400 border-white/10'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {status === 'paid' ? 'Completed' : status}
        </span>
    );
}

// ── Masked bank detail cell ────────────────────────────────────────────────────
function BankCell({ label, value, maskable, rawValue }) {
    const [revealed, setRevealed] = useState(false);
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '9px 12px',
        }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
                {label}
            </p>
            <div className="flex items-center gap-2">
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: 0, letterSpacing: label === 'IFSC Code' ? '0.04em' : 0 }}>
                    {maskable && !revealed ? value : (rawValue || value)}
                </p>
                {maskable && rawValue && (
                    <button
                        onClick={() => setRevealed(r => !r)}
                        style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                        {revealed ? '[ hide ]' : '[ show ]'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Financial card ────────────────────────────────────────────────────────────
function FinancialCard({ label, value, color = 'text-white', accent = false }) {
    return (
        <div className={`glass rounded-xl p-4 border ${accent ? 'border-brand-500/30' : 'border-white/5'}`}>
            <p className="text-xs uppercase tracking-widest text-surface-500 font-medium mb-1">{label}</p>
            <p className={`text-xl font-black ${color}`}>{formatCurrency(value)}</p>
        </div>
    );
}

// ── Main CreatorDetailDrawer ──────────────────────────────────────────────────
export default function CreatorDetailDrawer({ creatorId, onClose, onPayoutSuccess }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPayNow, setShowPayNow] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await adminService.getCreatorDetail(creatorId);
            setData(res.data?.data ?? res.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [creatorId]);

    useEffect(() => { load(); }, [load]);

    // Close on Escape key
    useEffect(() => {
        const h = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const handlePayoutSuccess = (payout) => {
        setShowPayNow(false);
        // Refresh drawer data
        load();
        // Propagate to parent list
        if (onPayoutSuccess && data) {
            const updated = {
                _id: creatorId,
                pendingAmount: 0,
                withdrawnAmount: (data.financials?.withdrawnAmount ?? 0) + payout.amount,
            };
            onPayoutSuccess(updated);
        }
    };

    const bank = data?.bankDetails;
    const fin = data?.financials ?? {};
    const user = data?.user ?? {};
    const profile = data?.profile ?? {};
    const payouts = data?.recentPayouts ?? [];
    const initials = (profile.displayName || user.name || '?')[0]?.toUpperCase();

    return (
        <>
            {/* ── Backdrop ───────────────────────────────────────────────── */}
            <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* ── Drawer ─────────────────────────────────────────────────── */}
            <div
                className="fixed top-0 right-0 z-50 h-full w-full max-w-xl flex flex-col shadow-2xl"
                style={{
                    background: 'linear-gradient(160deg, rgba(15,10,25,0.98) 0%, rgba(8,5,18,0.99) 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.07)',
                    animation: 'slideInRight 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                    <h2 className="font-bold text-white text-lg">Creator Detail</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-surface-700/60 hover:bg-surface-600 text-surface-400 hover:text-white transition-all flex items-center justify-center"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* ── Profile Header ──────────────────────────────────── */}
                    {loading ? (
                        <div className="flex items-center gap-4">
                            <Skeleton className="w-16 h-16 rounded-full" />
                            <div><Skeleton className="h-5 w-40 mb-2" /><Skeleton className="h-3 w-52" /></div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            {profile.profileImage ? (
                                <img src={profile.profileImage} alt={profile.displayName} className="w-16 h-16 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0" />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
                                    {initials}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-white font-bold text-lg truncate">{profile.displayName || user.name}</p>
                                <p className="text-surface-400 text-sm truncate">{user.email}</p>
                                {profile.username && <p className="text-surface-500 text-xs">@{profile.username}</p>}
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {profile.genre && (
                                        <span className="text-xs px-2 py-0.5 rounded-full border border-brand-500/20 bg-brand-500/10 text-brand-300 capitalize">{profile.genre}</span>
                                    )}
                                    <span className="text-xs text-surface-500">
                                        {(profile.totalSubscribers ?? 0).toLocaleString('en-IN')} subscribers
                                    </span>
                                    <span className="text-xs text-surface-600">
                                        Joined {formatDate(user.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Financial Summary ───────────────────────────────── */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-3">Financial Summary</h3>
                        {loading ? (
                            <div className="grid grid-cols-3 gap-3">
                                {[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <FinancialCard label="Total Earned" value={fin.totalEarned ?? 0} color="text-white" accent />
                                    <FinancialCard label="Pending" value={fin.pendingAmount ?? 0} color={(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'} />
                                    <FinancialCard label="Total Paid" value={fin.withdrawnAmount ?? 0} color="text-emerald-400" />
                                </div>

                                {/* ── This Week Card ──────────────────────────── */}
                                {(() => {
                                    const weekStart = fin.weekStart ? new Date(fin.weekStart) : null;
                                    const weekEnd   = fin.weekEnd   ? new Date(fin.weekEnd)   : null;
                                    const fmt = (d) => d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
                                    const weekLabel = weekStart && weekEnd
                                        ? `${fmt(weekStart)} – ${fmt(weekEnd)}`
                                        : '';
                                    return (
                                        <div style={{
                                            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))',
                                            border: '1px solid rgba(16,185,129,0.2)',
                                            borderRadius: 14,
                                            padding: '14px 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                        }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 13 }}>📅</span>
                                                    <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(16,185,129,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                                        This Week
                                                    </p>
                                                    {weekLabel && (
                                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                                                            ({weekLabel})
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: 20, fontWeight: 900, color: '#34d399', margin: 0 }}>
                                                    {formatCurrency(fin.weeklyEarnings ?? 0)}
                                                </p>
                                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                                    Sun 12:00 AM → Sat 11:59 PM
                                                </p>
                                            </div>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 12,
                                                background: 'rgba(16,185,129,0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 18, flexShrink: 0,
                                            }}>
                                                📈
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>

                    {/* ── Pay Now Button ──────────────────────────────────── */}
                    {!loading && (
                        <div
                            style={{
                                background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.04))',
                                border: '1px solid rgba(124,58,237,0.15)',
                                borderRadius: 14, padding: '16px',
                            }}
                        >
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <p className="text-white font-semibold text-sm">Pending Balance</p>
                                    <p className={`text-2xl font-black mt-0.5 ${(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'}`}>
                                        {formatCurrency(fin.pendingAmount ?? 0)}
                                    </p>
                                    {!bank && (
                                        <p className="text-xs text-red-400 mt-1">⚠️ No bank details on file</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowPayNow(true)}
                                    disabled={(fin.pendingAmount ?? 0) <= 0 || !bank}
                                    className="btn-brand px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                                    title={(fin.pendingAmount ?? 0) <= 0 ? 'No balance to pay' : !bank ? 'Bank details missing' : 'Pay now'}
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                    </svg>
                                    Pay Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Bank Details ────────────────────────────────────── */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">🏦</span>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500">Bank Details</h3>
                            <div className="flex-1 h-px bg-white/5" />
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-2 gap-2">
                                {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                            </div>
                        ) : !bank ? (
                            <p className="text-surface-600 text-sm italic">No bank details submitted yet.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <BankCell label="Account Holder" value={bank.accountHolderName || '—'} />
                                <BankCell label="Bank Name" value={bank.bankName || '—'} />
                                <BankCell
                                    label="Account Number"
                                    value={bank.accountNumber ? `••••${bank.last4}` : '—'}
                                    maskable
                                    rawValue={bank.accountNumber}
                                />
                                <BankCell label="IFSC Code" value={bank.ifscCode || '—'} />
                            </div>
                        )}
                    </div>

                    {/* ── Payout History ──────────────────────────────────── */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-surface-500 mb-3">
                            Recent Payouts
                        </h3>
                        {loading ? (
                            <div className="space-y-2">
                                {[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
                            </div>
                        ) : payouts.length === 0 ? (
                            <p className="text-surface-600 text-sm italic">No payout history yet.</p>
                        ) : (
                            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                                {payouts.map((p, idx) => (
                                    <div
                                        key={p._id}
                                        className={`flex items-center justify-between px-4 py-3 ${idx < payouts.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                                    >
                                        <div>
                                            <p className="text-xs text-surface-500">{formatDate(p.processedAt || p.requestedAt || p.createdAt)}</p>
                                            {p.notes && <p className="text-[11px] text-surface-600 mt-0.5">{p.notes}</p>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-bold text-white">{formatCurrency(p.amount)}</p>
                                            <StatusPill status={p.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* ── Pay Now Modal ───────────────────────────────────────────── */}
            {showPayNow && data && (
                <PayNowModal
                    creatorId={creatorId}
                    creatorName={profile.displayName || user.name}
                    pendingAmount={fin.pendingAmount ?? 0}
                    bankDetails={bank}
                    onClose={() => setShowPayNow(false)}
                    onSuccess={handlePayoutSuccess}
                />
            )}

            {/* Slide-in animation */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
            `}</style>
        </>
    );
}
