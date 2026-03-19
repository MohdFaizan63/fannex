import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '../../utils/helpers';
import PayNowModal from './PayNowModal';

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

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
            {status === 'paid' ? 'Paid' : status}
        </span>
    );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children, action }) {
    return (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <h2 className="font-bold text-white text-sm uppercase tracking-widest">{title}</h2>
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ── Financial card ────────────────────────────────────────────────────────────
function FinCard({ label, value, color = 'text-white', accent }) {
    return (
        <div className={`glass rounded-xl p-4 border ${accent ? 'border-brand-500/30' : 'border-white/5'}`}>
            <p className="text-xs uppercase tracking-widest text-surface-500 font-medium mb-1">{label}</p>
            <p className={`text-xl font-black ${color}`}>{formatCurrency(value)}</p>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminCreatorManage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData]             = useState(null);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [toast, setToast]           = useState({ msg: '', type: 'success' });
    const [showPayNow, setShowPayNow] = useState(false);
    const [banBusy, setBanBusy]       = useState(false);
    const [saveBusy, setSaveBusy]     = useState(false);

    // Edit-profile form state
    const [editMode, setEditMode] = useState(false);
    const [form, setForm]         = useState({});

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data: res } = await adminService.getCreatorDetail(id);
            setData(res.data ?? res);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // Seed form when data arrives
    useEffect(() => {
        if (data) {
            setForm({
                displayName: data.profile?.displayName || data.user?.name || '',
                bio: data.profile?.bio || '',
                subscriptionPrice: data.profile?.subscriptionPrice ?? '',
                genre: data.profile?.genre || '',
            });
        }
    }, [data]);

    const handleSaveProfile = async () => {
        setSaveBusy(true);
        try {
            await adminService.updateCreatorProfile(id, form);
            showToast('Profile updated successfully ✓');
            setEditMode(false);
            load();
        } catch (err) {
            showToast(getErrorMessage(err), 'error');
        } finally {
            setSaveBusy(false);
        }
    };

    const handleBanToggle = async () => {
        if (!data) return;
        const isBanned = data.user?.isBanned;
        setBanBusy(true);
        try {
            if (isBanned) await adminService.unbanCreator(id);
            else          await adminService.banCreator(id);
            showToast(`Creator ${isBanned ? 'unbanned' : 'banned'} successfully ✓`);
            load();
        } catch (err) {
            showToast(getErrorMessage(err), 'error');
        } finally {
            setBanBusy(false);
        }
    };

    const handlePayoutSuccess = () => {
        setShowPayNow(false);
        showToast('Payout completed successfully 🎉');
        load();
    };

    // Derived
    const fin     = data?.financials ?? {};
    const bank    = data?.bankDetails;
    const profile = data?.profile ?? {};
    const user    = data?.user ?? {};
    const payouts = data?.recentPayouts ?? [];

    const initials = (profile.displayName || user.name || '?')[0]?.toUpperCase();

    return (
        <div className="p-4 sm:p-6 max-w-5xl">

            {/* ── Back navigation ─────────────────────────────────────── */}
            <Link
                to="/admin/creators"
                className="inline-flex items-center gap-2 text-surface-400 hover:text-white transition-colors text-sm mb-6"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Creators
            </Link>

            {/* ── Toast ───────────────────────────────────────────────── */}
            {toast.msg && (
                <div className={`mb-5 px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${
                    toast.type === 'error'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                    <span>{toast.type === 'error' ? '✕' : '✓'}</span>
                    {toast.msg}
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────────── */}
            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                1. PROFILE HEADER
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 p-5 sm:p-6 mb-5 flex flex-col sm:flex-row sm:items-center gap-5">
                {loading ? (
                    <div className="flex items-center gap-4 flex-1">
                        <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                            <Skeleton className="h-6 w-48 mb-2" />
                            <Skeleton className="h-4 w-64 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            {profile.profileImage ? (
                                <img src={profile.profileImage} alt={profile.displayName} className="w-20 h-20 rounded-full object-cover ring-2 ring-brand-500/40" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-2xl font-black">
                                    {initials}
                                </div>
                            )}
                            {/* Status dot */}
                            <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-surface-900 ${user.isBanned ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-black text-white truncate">{profile.displayName || user.name}</h1>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${user.isBanned ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                    {user.isBanned ? '⛔ Banned' : '✓ Active'}
                                </span>
                            </div>
                            <p className="text-surface-400 text-sm mt-0.5">{user.email}</p>
                            {profile.username && <p className="text-surface-500 text-xs mt-0.5">@{profile.username}</p>}
                            <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-surface-500">
                                {profile.genre && <span className="capitalize">🎭 {profile.genre}</span>}
                                <span>👥 {(profile.totalSubscribers ?? 0).toLocaleString('en-IN')} subscribers</span>
                                <span>📅 Joined {formatDate(user.createdAt)}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                            <button
                                onClick={handleBanToggle}
                                disabled={banBusy}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40 ${
                                    user.isBanned
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                }`}
                            >
                                {banBusy ? '…' : user.isBanned ? '✓ Unban Creator' : '⛔ Ban Creator'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════
                2. FINANCIAL SUMMARY + PAY NOW
            ════════════════════════════════════════════════════════ */}
            <Section title="Financial Summary" icon="💰">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                    </div>
                ) : (
                    <>
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <FinCard label="Total Earned"   value={fin.totalEarned ?? 0}     color="text-white" accent />
                            <FinCard label="Pending"        value={fin.pendingAmount ?? 0}    color={(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'} />
                            <FinCard label="Paid Out"       value={fin.withdrawnAmount ?? 0}  color="text-emerald-400" />
                            <FinCard label="This Week"      value={fin.weeklyEarnings ?? 0}   color="text-sky-400" />
                        </div>

                        {/* Week range label */}
                        {fin.weekStart && fin.weekEnd && (() => {
                            const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                            return (
                                <p className="text-xs text-surface-600 mb-4">
                                    📅 This Week: {fmt(fin.weekStart)} – {fmt(fin.weekEnd)} (Sun 12:00 AM → Sat 11:59 PM)
                                </p>
                            );
                        })()}

                        {/* Pay Now strip */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.04))',
                            border: '1px solid rgba(124,58,237,0.15)',
                            borderRadius: 14, padding: '14px 18px',
                        }} className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-white font-semibold text-sm">Pending Balance</p>
                                <p className={`text-2xl font-black mt-0.5 ${(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'}`}>
                                    {formatCurrency(fin.pendingAmount ?? 0)}
                                </p>
                                {!bank && <p className="text-xs text-red-400 mt-1">⚠️ No bank details on file</p>}
                            </div>
                            <button
                                onClick={() => setShowPayNow(true)}
                                disabled={(fin.pendingAmount ?? 0) <= 0 || !bank}
                                className="btn-brand px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                title={(fin.pendingAmount ?? 0) <= 0 ? 'No balance to pay' : !bank ? 'Bank details missing' : 'Pay now'}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                                Pay Now
                            </button>
                        </div>
                    </>
                )}
            </Section>

            {/* ════════════════════════════════════════════════════════
                3. EDIT PROFILE
            ════════════════════════════════════════════════════════ */}
            <div className="mt-5">
                <Section
                    title="Creator Profile"
                    icon="✏️"
                    action={
                        !loading && (
                            editMode ? (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 hover:text-white transition-all">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={saveBusy}
                                        className="btn-brand text-xs px-4 py-1.5 rounded-lg disabled:opacity-40"
                                    >
                                        {saveBusy ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="text-xs px-4 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold"
                                >
                                    ✏️ Edit
                                </button>
                            )
                        )
                    }
                >
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                        </div>
                    ) : editMode ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wider">Display Name</label>
                                <input
                                    className="input-dark w-full"
                                    value={form.displayName}
                                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                    placeholder="Display name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wider">Genre / Category</label>
                                <input
                                    className="input-dark w-full"
                                    value={form.genre}
                                    onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                                    placeholder="e.g. music, gaming, fitness"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wider">Subscription Price (₹)</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="input-dark w-full"
                                    value={form.subscriptionPrice}
                                    onChange={e => setForm(f => ({ ...f, subscriptionPrice: e.target.value }))}
                                    placeholder="e.g. 199"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wider">Bio</label>
                                <textarea
                                    rows={3}
                                    className="input-dark w-full resize-none"
                                    value={form.bio}
                                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                                    placeholder="Creator bio…"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { label: 'Display Name',         value: profile.displayName || '—' },
                                { label: 'Username',             value: profile.username ? `@${profile.username}` : '—' },
                                { label: 'Genre',                value: profile.genre || '—' },
                                { label: 'Subscription Price',   value: profile.subscriptionPrice ? formatCurrency(profile.subscriptionPrice) : '—' },
                                { label: 'Subscribers',          value: (profile.totalSubscribers ?? 0).toLocaleString('en-IN') },
                                { label: 'Total Posts',          value: (profile.totalPosts ?? 0).toLocaleString('en-IN') },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                                    <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{value}</p>
                                </div>
                            ))}
                            {profile.bio && (
                                <div className="sm:col-span-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Bio</p>
                                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{profile.bio}</p>
                                </div>
                            )}
                        </div>
                    )}
                </Section>
            </div>

            {/* ════════════════════════════════════════════════════════
                4. BANK DETAILS
            ════════════════════════════════════════════════════════ */}
            <div className="mt-5">
                <Section title="Bank Details" icon="🏦">
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[0,1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                        </div>
                    ) : !bank ? (
                        <p className="text-surface-600 text-sm italic">No bank details submitted yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Account Holder', value: bank.accountHolderName || '—' },
                                { label: 'Bank Name',      value: bank.bankName || '—' },
                                { label: 'Account No.',    value: bank.accountNumber ? `••••${bank.last4}` : '—' },
                                { label: 'IFSC',           value: bank.ifscCode || '—' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '9px 12px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </div>

            {/* ════════════════════════════════════════════════════════
                5. PAYOUT HISTORY
            ════════════════════════════════════════════════════════ */}
            <div className="mt-5 mb-10">
                <Section title="Payout History" icon="📜" action={
                    <span className="text-xs text-surface-500">{payouts.length} record{payouts.length !== 1 ? 's' : ''}</span>
                }>
                    {loading ? (
                        <div className="space-y-3">
                            {[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                        </div>
                    ) : payouts.length === 0 ? (
                        <div className="py-10 flex flex-col items-center gap-2 text-surface-600">
                            <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                            </svg>
                            <p className="text-sm">No payout history yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {['Date', 'Amount', 'Status', 'Paid On', 'Notes'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {payouts.map(p => (
                                        <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">
                                                {formatDate(p.requestedAt || p.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                                                {formatCurrency(p.amount)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <StatusPill status={p.status} />
                                            </td>
                                            <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">
                                                {p.processedAt ? formatDateTime(p.processedAt) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-surface-600 text-xs">
                                                {p.notes || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>
            </div>

            {/* ── Pay Now Modal ─────────────────────────────────────── */}
            {showPayNow && data && (
                <PayNowModal
                    creatorId={id}
                    creatorName={profile.displayName || user.name}
                    pendingAmount={fin.pendingAmount ?? 0}
                    bankDetails={bank}
                    onClose={() => setShowPayNow(false)}
                    onSuccess={handlePayoutSuccess}
                />
            )}
        </div>
    );
}
