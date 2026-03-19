import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '../../utils/helpers';
import PayNowModal from './PayNowModal';

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`skeleton animate-pulse rounded-xl ${className}`} />;
}

const PAYOUT_STATUS = {
    pending:  { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25',   label: 'Pending' },
    approved: { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25',      label: 'Approved' },
    paid:     { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', label: '✓ Paid' },
    rejected: { cls: 'bg-red-500/15 text-red-400 border-red-500/25',         label: 'Rejected' },
};
function StatusPill({ status }) {
    const s = PAYOUT_STATUS[status] ?? { cls: 'bg-surface-700 text-surface-400 border-white/10', label: status };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{s.label}
        </span>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminCreatorManage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [toast,      setToast]      = useState({ msg: '', type: 'success' });
    const [showPayNow, setShowPayNow] = useState(false);
    const [banBusy,    setBanBusy]    = useState(false);

    // Profile edit
    const [editProfile, setEditProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});
    const [savingProfile, setSavingProfile] = useState(false);

    // Financials edit
    const [editFin,   setEditFin]   = useState(false);
    const [finForm,   setFinForm]   = useState({});
    const [savingFin, setSavingFin] = useState(false);

    const flash = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data: res } = await adminService.getCreatorDetail(id);
            setData(res.data ?? res);
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // Seed forms
    useEffect(() => {
        if (!data) return;
        setProfileForm({
            displayName: data.profile?.displayName || data.user?.name || '',
            bio:         data.profile?.bio || '',
            subscriptionPrice: data.profile?.subscriptionPrice ?? '',
            genre:       data.profile?.genre || '',
        });
        setFinForm({
            totalEarned:    data.financials?.totalEarned    ?? 0,
            pendingAmount:  data.financials?.pendingAmount  ?? 0,
            withdrawnAmount: data.financials?.withdrawnAmount ?? 0,
        });
    }, [data]);

    const saveProfile = async () => {
        setSavingProfile(true);
        try {
            await adminService.updateCreatorProfile(id, profileForm);
            flash('Profile updated ✓');
            setEditProfile(false); load();
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setSavingProfile(false); }
    };

    const saveFinancials = async () => {
        setSavingFin(true);
        try {
            await adminService.updateCreatorFinancials(id, finForm);
            flash('Financials updated ✓');
            setEditFin(false); load();
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setSavingFin(false); }
    };

    const toggleBan = async () => {
        setBanBusy(true);
        try {
            if (data?.user?.isBanned) await adminService.unbanCreator(id);
            else                       await adminService.banCreator(id);
            flash(`Creator ${data?.user?.isBanned ? 'unbanned' : 'banned'} ✓`);
            load();
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setBanBusy(false); }
    };

    const fin     = data?.financials ?? {};
    const bank    = data?.bankDetails;
    const profile = data?.profile ?? {};
    const user    = data?.user ?? {};
    const payouts = data?.recentPayouts ?? [];
    const initials = (profile.displayName || user.name || '?')[0]?.toUpperCase();

    // ── Input style helper ────────────────────────────────────────────────────
    const inp = 'w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all';
    const inpStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">

            {/* ── Back ──────────────────────────────────────────────── */}
            <Link to="/admin/creators" className="inline-flex items-center gap-2 text-surface-500 hover:text-white transition-colors text-sm mb-6 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Creators
            </Link>

            {/* ── Toast ─────────────────────────────────────────────── */}
            {toast.msg && (
                <div className={`mb-5 px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${
                    toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                    <span className="text-base">{toast.type === 'error' ? '✕' : '✓'}</span>
                    {toast.msg}
                </div>
            )}
            {error && <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            {/* ════════════════════════════════════════════════════════
                PROFILE HERO CARD
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-5">
                {/* Gradient top banner */}
                <div style={{ height: 72, background: 'linear-gradient(135deg, rgba(124,58,237,0.35) 0%, rgba(168,85,247,0.2) 50%, rgba(217,70,219,0.15) 100%)' }} />

                <div className="px-5 pb-5 -mt-9">
                    {loading ? (
                        <div className="flex gap-4 items-end">
                            <Skeleton className="w-20 h-20 rounded-full border-4 border-surface-900 flex-shrink-0" />
                            <div className="mb-1 flex-1"><Skeleton className="h-5 w-40 mb-2" /><Skeleton className="h-3 w-56" /></div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end justify-between gap-4 flex-wrap">
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {profile.profileImage ? (
                                        <img src={profile.profileImage} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-surface-900 ring-2 ring-brand-500/30" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full border-4 border-surface-900 bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-2xl font-black">
                                            {initials}
                                        </div>
                                    )}
                                    <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-surface-900 ${user.isBanned ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                </div>

                                {/* Ban button */}
                                <button
                                    onClick={toggleBan}
                                    disabled={banBusy}
                                    className={`mb-1 px-4 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 flex-shrink-0 ${
                                        user.isBanned
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                                    }`}
                                >
                                    {banBusy ? '…' : user.isBanned ? '✓ Unban Creator' : '⛔ Ban Creator'}
                                </button>
                            </div>

                            {/* Name + meta */}
                            <div className="mt-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-black text-white">{profile.displayName || user.name}</h1>
                                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${user.isBanned ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                        {user.isBanned ? '⛔ Banned' : '✓ Active'}
                                    </span>
                                </div>
                                <p className="text-surface-400 text-sm mt-0.5">{user.email}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-surface-500">
                                    {profile.username && <span className="text-brand-400">@{profile.username}</span>}
                                    {profile.genre   && <span className="capitalize bg-brand-500/10 border border-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">{profile.genre}</span>}
                                    <span>👥 {(profile.totalSubscribers ?? 0).toLocaleString('en-IN')} subscribers</span>
                                    <span>📅 Joined {formatDate(user.createdAt)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                FINANCIAL SUMMARY + PAY NOW
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-5">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <span>💰</span>
                        <h2 className="font-black text-white text-sm uppercase tracking-widest">Financial Summary</h2>
                    </div>
                    {!loading && (
                        editFin ? (
                            <div className="flex gap-2">
                                <button onClick={() => setEditFin(false)} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 hover:text-white transition-all">Cancel</button>
                                <button onClick={saveFinancials} disabled={savingFin} className="btn-brand text-xs px-4 py-1.5 rounded-lg disabled:opacity-40">
                                    {savingFin ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setEditFin(true)} className="text-xs px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold">
                                ✏️ Edit Amounts
                            </button>
                        )
                    )}
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            {[0,1,2].map(i => <Skeleton key={i} className="h-24" />)}
                        </div>
                    ) : editFin ? (
                        /* ── Edit Mode: financial inputs ── */
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            {[
                                { key: 'totalEarned',    label: 'Total Earned (₹)',  color: 'text-white' },
                                { key: 'pendingAmount',  label: 'Pending Amount (₹)', color: 'text-amber-400' },
                                { key: 'withdrawnAmount', label: 'Paid Out (₹)',     color: 'text-emerald-400' },
                            ].map(({ key, label, color }) => (
                                <div key={key}>
                                    <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${color}`}>{label}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={inp}
                                        style={inpStyle}
                                        value={finForm[key]}
                                        onChange={e => setFinForm(f => ({ ...f, [key]: e.target.value }))}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ── View Mode: stat cards ── */
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            {[
                                { label: 'Total Earned', val: fin.totalEarned    ?? 0, color: 'text-white',        grad: 'from-brand-500/20 to-violet-600/10',    border: 'border-brand-500/20'    },
                                { label: 'Pending',      val: fin.pendingAmount  ?? 0, color: 'text-amber-400',    grad: 'from-amber-500/15 to-orange-500/5',     border: 'border-amber-500/20'    },
                                { label: 'Paid Out',     val: fin.withdrawnAmount ?? 0, color: 'text-emerald-400', grad: 'from-emerald-500/15 to-teal-500/5',     border: 'border-emerald-500/20'  },
                                { label: 'This Week',    val: fin.weeklyEarnings  ?? 0, color: 'text-sky-400',     grad: 'from-sky-500/15 to-cyan-500/5',           border: 'border-sky-500/20'     },
                            ].map(({ label, val, color, grad, border }) => (
                                <div key={label} className={`bg-gradient-to-br ${grad} rounded-xl p-4 border ${border}`}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500 mb-1.5">{label}</p>
                                    <p className={`text-lg font-black ${color}`}>{formatCurrency(val)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Week range */}
                    {!loading && !editFin && fin.weekStart && fin.weekEnd && (() => {
                        const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                        return <p className="text-xs text-surface-600 mb-4">📅 {fmt(fin.weekStart)} – {fmt(fin.weekEnd)} (Sun–Sat)</p>;
                    })()}

                    {/* Pay Now panel */}
                    {!loading && (
                        <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(168,85,247,0.05))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px' }}
                             className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-white font-bold text-sm">Pending Balance</p>
                                <p className={`text-3xl font-black mt-0.5 ${(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'}`}>
                                    {formatCurrency(fin.pendingAmount ?? 0)}
                                </p>
                                {!bank && <p className="text-xs text-red-400 mt-1">⚠️ No bank details on file</p>}
                            </div>
                            <button
                                onClick={() => setShowPayNow(true)}
                                disabled={(fin.pendingAmount ?? 0) <= 0 || !bank}
                                className="btn-brand px-6 py-3 rounded-xl font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                                Pay Now
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                CREATOR PROFILE (editable)
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-5">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <span>✏️</span>
                        <h2 className="font-black text-white text-sm uppercase tracking-widest">Creator Profile</h2>
                    </div>
                    {!loading && (
                        editProfile ? (
                            <div className="flex gap-2">
                                <button onClick={() => setEditProfile(false)} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 hover:text-white transition-all">Cancel</button>
                                <button onClick={saveProfile} disabled={savingProfile} className="btn-brand text-xs px-4 py-1.5 rounded-lg disabled:opacity-40">
                                    {savingProfile ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => setEditProfile(true)} className="text-xs px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold">
                                ✏️ Edit
                            </button>
                        )
                    )}
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
                    ) : editProfile ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'displayName', label: 'Display Name',       type: 'text',   placeholder: 'Creator name' },
                                { key: 'genre',       label: 'Genre / Category',   type: 'text',   placeholder: 'e.g. music, fitness' },
                                { key: 'subscriptionPrice', label: 'Sub Price (₹)', type: 'number', placeholder: '199' },
                            ].map(({ key, label, type, placeholder }) => (
                                <div key={key}>
                                    <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wider">{label}</label>
                                    <input type={type} min={type === 'number' ? 1 : undefined} className={inp} style={inpStyle}
                                        value={profileForm[key] ?? ''} placeholder={placeholder}
                                        onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} />
                                </div>
                            ))}
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wider">Bio</label>
                                <textarea rows={3} className={`${inp} resize-none`} style={inpStyle}
                                    value={profileForm.bio ?? ''} placeholder="Creator bio…"
                                    onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                                { label: 'Display Name',     value: profile.displayName      || '—' },
                                { label: 'Username',         value: profile.username ? `@${profile.username}` : '—' },
                                { label: 'Genre',            value: profile.genre            || '—' },
                                { label: 'Sub Price',        value: profile.subscriptionPrice ? formatCurrency(profile.subscriptionPrice) : '—' },
                                { label: 'Subscribers',      value: (profile.totalSubscribers ?? 0).toLocaleString('en-IN') },
                                { label: 'Total Posts',      value: (profile.totalPosts      ?? 0).toLocaleString('en-IN') },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{value}</p>
                                </div>
                            ))}
                            {profile.bio && (
                                <div className="col-span-2 sm:col-span-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Bio</p>
                                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{profile.bio}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                BANK DETAILS
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-5">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                    <span>🏦</span>
                    <h2 className="font-black text-white text-sm uppercase tracking-widest">Bank Details</h2>
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
                    ) : !bank ? (
                        <p className="text-surface-600 text-sm italic text-center py-4">No bank details submitted yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Account Holder', value: bank.accountHolderName || '—' },
                                { label: 'Bank Name',      value: bank.bankName           || '—' },
                                { label: 'Account No.',    value: bank.accountNumber ? `••••${bank.last4}` : '—' },
                                { label: 'IFSC',           value: bank.ifscCode           || '—' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: label === 'IFSC' || label === 'Account No.' ? 'monospace' : 'inherit' }}>{value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                PAYOUT HISTORY
            ════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-10">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <span>📜</span>
                        <h2 className="font-black text-white text-sm uppercase tracking-widest">Payout History</h2>
                    </div>
                    <span className="text-xs text-surface-600">{payouts.length} record{payouts.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="p-5">
                    {loading ? (
                        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-14" />)}</div>
                    ) : payouts.length === 0 ? (
                        <div className="py-12 flex flex-col items-center gap-2 text-surface-600">
                            <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                            </svg>
                            <p className="text-sm">No payout history yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm min-w-[520px]">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {['Requested', 'Amount', 'Status', 'Paid On', 'Notes'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-surface-600 font-bold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {payouts.map(p => (
                                        <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-3 text-surface-400 text-xs whitespace-nowrap">{formatDate(p.requestedAt || p.createdAt)}</td>
                                            <td className="px-3 py-3 font-black text-white whitespace-nowrap">{formatCurrency(p.amount)}</td>
                                            <td className="px-3 py-3 whitespace-nowrap"><StatusPill status={p.status} /></td>
                                            <td className="px-3 py-3 text-surface-500 text-xs whitespace-nowrap">{p.processedAt ? formatDateTime(p.processedAt) : '—'}</td>
                                            <td className="px-3 py-3 text-surface-600 text-xs">{p.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Pay Now Modal ─────────────────────────────────────── */}
            {showPayNow && data && (
                <PayNowModal
                    creatorId={id}
                    creatorName={profile.displayName || user.name}
                    pendingAmount={fin.pendingAmount ?? 0}
                    bankDetails={bank}
                    onClose={() => setShowPayNow(false)}
                    onSuccess={() => { setShowPayNow(false); flash('Payout completed 🎉'); load(); }}
                />
            )}
        </div>
    );
}
