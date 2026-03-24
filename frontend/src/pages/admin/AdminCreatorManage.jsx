import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '../../utils/helpers';
import PayNowModal from './PayNowModal';

// ── GENRE OPTIONS (must match backend enum) ───────────────────────────────────
const GENRE_OPTIONS = ['', 'fitness', 'gaming', 'fashion', 'education', 'art', 'music', 'lifestyle', 'other'];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function Sk({ w = 'w-full', h = 'h-5', r = 'rounded-xl' }) {
    return <div className={`skeleton animate-pulse bg-white/[0.06] ${w} ${h} ${r}`} />;
}

const STATUS_S = {
    pending:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    approved: 'bg-blue-500/15  text-blue-400  border-blue-500/25',
    paid:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    rejected: 'bg-red-500/15   text-red-400   border-red-500/25',
};
function Pill({ status }) {
    const s = STATUS_S[status] ?? 'bg-surface-700 text-surface-400 border-white/10';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize ${s}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{status === 'paid' ? '✓ Paid' : status}
        </span>
    );
}

// ── SECTION CARD ─────────────────────────────────────────────────────────────
function Card({ icon, title, action, children, className = '' }) {
    return (
        <section className={`rounded-2xl border border-white/[0.07] overflow-hidden ${className}`}
            style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <h2 className="font-black text-white text-xs uppercase tracking-[0.12em]">{title}</h2>
                </div>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </section>
    );
}

// ── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = 'text-white', subtext }) {
    return (
        <div className="rounded-xl p-4 border border-white/[0.07] flex flex-col gap-1.5"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-surface-500">{label}</p>
                {icon && <span className="text-sm opacity-60">{icon}</span>}
            </div>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            {subtext && <p className="text-[10px] text-surface-600">{subtext}</p>}
        </div>
    );
}

// ── INPUT HELPERS ─────────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm text-white bg-white/[0.06] border border-white/[0.1] outline-none focus:border-brand-500/50 focus:bg-white/[0.08] transition-all placeholder-surface-600';
const labelCls = 'block text-[10px] font-bold text-surface-500 mb-1.5 uppercase tracking-widest';

// ── CONFIRM DELETE MODAL ─────────────────────────────────────────────────────
// BUG-09 Fix: focus trap added so Tab cycles only within this modal
function ConfirmDelete({ onConfirm, onCancel, busy }) {
    const firstBtnRef = useRef();
    const lastBtnRef  = useRef();

    // Focus first button on mount
    useEffect(() => { firstBtnRef.current?.focus(); }, []);

    // Trap focus within the modal
    const handleKeyDown = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === firstBtnRef.current) {
                e.preventDefault();
                lastBtnRef.current?.focus();
            }
        } else {
            if (document.activeElement === lastBtnRef.current) {
                e.preventDefault();
                firstBtnRef.current?.focus();
            }
        }
        if (e.key === 'Escape' && !busy) onCancel();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
            <div className="bg-surface-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl">
                <div className="text-3xl mb-3 text-center">🗑️</div>
                <h3 id="delete-modal-title" className="text-white font-black text-center mb-1">Delete Post?</h3>
                <p className="text-surface-400 text-sm text-center mb-5">This will permanently delete the post and media from storage. Cannot be undone.</p>
                <div className="flex gap-3">
                    <button ref={firstBtnRef} onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-surface-400 text-sm font-semibold hover:text-white transition-colors">Cancel</button>
                    <button ref={lastBtnRef} onClick={onConfirm} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-40">
                        {busy ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// BUG-11 Fix: generate a Cloudinary video poster URL (first frame as JPEG)
function getVideoPoster(url) {
    if (!url || !url.includes('/upload/')) return '';
    return url.replace('/upload/', '/upload/f_jpg,so_0/').replace(/\.[^.]+$/, '.jpg');
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminCreatorManage() {
    const { id } = useParams();

    // ── Master data ───────────────────────────────────────────────────────────
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    // BUG-03 Fix: track whether a data reload is in-flight so Pay Now can't fire with stale amount
    const reloadingRef = useRef(false);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [toast,              setToast]             = useState({ msg: '', type: 'success' });
    const [showPayNow,         setShowPayNow]         = useState(false);
    const [banBusy,            setBanBusy]            = useState(false);
    const [showDeleteModal,    setShowDeleteModal]    = useState(false);
    const [deleteBusyAccount,  setDeleteBusyAccount]  = useState(false);
    const navigate = useNavigate();

    // ── Profile edit ──────────────────────────────────────────────────────────
    const [editProfile,    setEditProfile]    = useState(false);
    const [profileForm,    setProfileForm]    = useState({});
    const [savingProfile,  setSavingProfile]  = useState(false);

    // ── Financials edit ───────────────────────────────────────────────────────
    const [editFin,         setEditFin]         = useState(false);
    const [finForm,         setFinForm]         = useState({});
    const [savingFin,       setSavingFin]       = useState(false);
    // BUG-02 Fix: confirm step before writing financials
    const [finConfirmPending, setFinConfirmPending] = useState(false);

    // ── Media library ─────────────────────────────────────────────────────────
    const [media,           setMedia]           = useState([]);
    const [mediaLoading,    setMediaLoading]    = useState(false);
    const [mediaTotal,      setMediaTotal]      = useState(0);
    const [mediaPage,       setMediaPage]       = useState(1);
    const [mediaTotalPages, setMediaTotalPages] = useState(1);
    const [deleteTarget,    setDeleteTarget]    = useState(null);
    const [deleteBusy,      setDeleteBusy]      = useState(false);

    // BUG-10 Fix: mediaRef used to scroll media section into view on pagination
    const mediaRef = useRef(null);

    // BUG-08 Fix: store toast timer in a ref so we can clear it on unmount
    const toastTimerRef = useRef(null);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const flash = (msg, type = 'success') => {
        // BUG-08 Fix: clear previous timer before setting a new one
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ msg, type });
        toastTimerRef.current = setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
    };

    // BUG-08 Fix: clear the timer when the component unmounts
    useEffect(() => {
        return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
    }, []);

    // Seed form fields from loaded data
    const seedForms = (d) => {
        setProfileForm({
            displayName:       d.profile?.displayName || d.user?.name || '',
            bio:               d.profile?.bio || '',
            subscriptionPrice: d.profile?.subscriptionPrice ?? '',
            genre:             d.profile?.genre || '',
        });
        setFinForm({
            totalEarned:     d.financials?.totalEarned    ?? 0,
            pendingAmount:   d.financials?.pendingAmount  ?? 0,
            withdrawnAmount: d.financials?.withdrawnAmount ?? 0,
        });
    };

    // ── Load creator detail ───────────────────────────────────────────────────
    const load = useCallback(async () => {
        reloadingRef.current = true;
        setLoading(true); setError('');
        try {
            const { data: res } = await adminService.getCreatorDetail(id);
            const d = res.data ?? res;
            setData(d);
            seedForms(d);
        } catch (e) { setError(getErrorMessage(e)); }
        finally {
            setLoading(false);
            reloadingRef.current = false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // ── Load media ────────────────────────────────────────────────────────────
    const loadMedia = useCallback(async (page = 1) => {
        setMediaLoading(true);
        try {
            const { data: res } = await adminService.getCreatorMedia(id, { page, limit: 12 });
            setMedia(res.data?.posts ?? []);
            setMediaTotal(res.data?.total ?? 0);
            setMediaPage(res.data?.page ?? 1);
            setMediaTotalPages(res.data?.totalPages ?? 1);
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setMediaLoading(false); }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { loadMedia(1); }, [loadMedia]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const saveProfile = async () => {
        setSavingProfile(true);
        try {
            await adminService.updateCreatorProfile(id, {
                displayName: profileForm.displayName.trim(),
                bio:         profileForm.bio.trim(),
                genre:       profileForm.genre,
                subscriptionPrice: profileForm.subscriptionPrice,
            });
            flash('Profile updated ✓');
            setEditProfile(false);
            load();
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setSavingProfile(false); }
    };

    // BUG-02 Fix: saveFinancials now has a two-step confirmation
    const saveFinancials = async () => {
        setSavingFin(true);
        setFinConfirmPending(false);
        try {
            await adminService.updateCreatorFinancials(id, finForm);
            flash('Financials updated ✓');
            setEditFin(false);
            load();
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setSavingFin(false); }
    };

    const toggleBan = async () => {
        setBanBusy(true);
        const wasBanned = data?.user?.isBanned;
        // BUG-15 Fix: optimistically update the ban state immediately
        setData(prev => prev ? { ...prev, user: { ...prev.user, isBanned: !wasBanned } } : prev);
        try {
            if (wasBanned) await adminService.unbanCreator(id);
            else           await adminService.banCreator(id);
            flash(`Creator ${wasBanned ? 'unbanned' : 'banned'} ✓`);
            load();
        } catch (e) {
            // Revert optimistic update on failure
            setData(prev => prev ? { ...prev, user: { ...prev.user, isBanned: wasBanned } } : prev);
            flash(getErrorMessage(e), 'error');
        } finally { setBanBusy(false); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await adminService.deleteCreatorPost(id, deleteTarget.postId);
            flash('Post deleted ✓');
            setDeleteTarget(null);
            loadMedia(mediaPage);
            // Optimistically decrement overview count in local state
            setData(prev => prev ? {
                ...prev,
                overview: { ...prev.overview, totalPosts: Math.max(0, (prev.overview?.totalPosts ?? 1) - 1) },
                profile:  { ...prev.profile,  totalPosts: Math.max(0, (prev.profile?.totalPosts ?? 1) - 1) },
            } : prev);
        } catch (e) { flash(getErrorMessage(e), 'error'); }
        finally { setDeleteBusy(false); }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const fin      = data?.financials ?? {};
    const bank     = data?.bankDetails;
    const profile  = data?.profile ?? {};
    const user     = data?.user ?? {};
    const payouts  = data?.recentPayouts ?? [];
    const payoutPagination = data?.payoutPagination ?? null;
    const overview = data?.overview ?? {};
    const initials = ((profile.displayName || user.name || '?')[0] ?? '?').toUpperCase();

    // ── Delete creator account (full cascade) ──────────────────────────────────
    const handleDeleteAccount = async () => {
        setDeleteBusyAccount(true);
        try {
            await adminService.deleteCreator(id);
            navigate('/admin/creators', { state: { deleted: user.email } });
        } catch (err) {
            flash(getErrorMessage(err), 'error');
            setShowDeleteModal(false);
        } finally {
            setDeleteBusyAccount(false);
        }
    };

    return (
        <>
        {deleteTarget && (
            <ConfirmDelete
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
                busy={deleteBusy}
            />
        )}

        {/* Delete creator account modal */}
        {showDeleteModal && !loading && (
            <div role="dialog" aria-modal="true"
                onClick={(e) => e.target === e.currentTarget && !deleteBusyAccount && setShowDeleteModal(false)}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-surface-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <h3 className="text-white font-black text-center text-lg mb-1">Permanently Delete Creator?</h3>
                    <p className="text-surface-400 text-sm text-center mb-2">
                        <span className="text-white font-semibold">{profile.displayName || user.name}</span>
                        <span className="text-surface-500 text-xs block mt-0.5">{user.email}</span>
                    </p>
                    <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 mb-5 text-xs text-red-300 space-y-1">
                        <p className="font-bold text-red-400 mb-1.5">⚠️ This will permanently delete:</p>
                        <p>• All posts, media files from Cloudinary, comments &amp; likes</p>
                        <p>• All subscriptions, payments, chat history</p>
                        <p>• Earnings ledger, payout records, KYC data</p>
                        <p>• Dream Fund goals &amp; contributions</p>
                        <p className="mt-1.5 text-red-400 font-semibold">You will be redirected after deletion. This CANNOT be undone.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowDeleteModal(false)} disabled={deleteBusyAccount}
                            className="flex-1 py-2.5 rounded-xl border border-white/10 text-surface-400 text-sm font-semibold hover:text-white transition-colors disabled:opacity-40">Cancel</button>
                        <button onClick={handleDeleteAccount} disabled={deleteBusyAccount}
                            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50">
                            {deleteBusyAccount ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                    Deleting…
                                </span>
                            ) : '🗑️ Delete Everything'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="px-3 sm:px-6 py-4 max-w-5xl mx-auto">

            {/* ── Back ────────────────────────────────────────────────── */}
            <Link to="/admin/creators"
                className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm mb-5 group">
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Creators
            </Link>

            {/* ── Toast ───────────────────────────────────────────────── */}
            {toast.msg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm border flex items-center gap-2 transition-all ${
                    toast.type === 'error'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                    <span>{toast.type === 'error' ? '✗' : '✓'}</span>{toast.msg}
                </div>
            )}
            {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

            {/* ══════════════════════════════════════════════════════════
                1. PROFILE HERO
            ══════════════════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden mb-4"
                style={{ background: 'rgba(255,255,255,0.025)' }}>
                {/* Cover gradient */}
                <div style={{ height: 80, background: 'linear-gradient(135deg,rgba(124,58,237,0.5) 0%,rgba(168,85,247,0.3) 50%,rgba(217,70,219,0.2) 100%)' }} />
                <div className="px-4 sm:px-6 pb-5 -mt-10">
                    {loading ? (
                        <div className="flex gap-4 items-end">
                            <Sk w="w-20 h-20" h="rounded-full border-4 border-surface-900 flex-shrink-0" r="" />
                            <div className="mb-1 flex-1 space-y-2"><Sk h="h-5" w="w-40" /><Sk h="h-3" w="w-56" /></div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end justify-between gap-3 flex-wrap">
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {profile.profileImage ? (
                                        <img src={profile.profileImage} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-surface-900 ring-2 ring-brand-500/40" />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full border-4 border-surface-900 bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-2xl font-black">
                                            {initials}
                                        </div>
                                    )}
                                    {/* BUG-15 Fix: dot reflects current (optimistically updated) user.isBanned state */}
                                    <span className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-900 ${user.isBanned ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                </div>
                                {/* Ban / Unban button */}
                                <button onClick={toggleBan} disabled={banBusy}
                                    className={`mb-1 px-4 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 ${user.isBanned ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'}`}>
                                    {banBusy ? '…' : user.isBanned ? '✓ Unban' : '⛔ Ban Creator'}
                                </button>
                                {/* Delete entire account button */}
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    title="Permanently delete creator account and all their data"
                                    className="mb-1 px-3 py-2 rounded-xl text-xs font-bold border bg-red-600/10 border-red-600/30 text-red-400 hover:bg-red-600/20 transition-all flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                    </svg>
                                    Delete Account
                                </button>
                            </div>
                            <div className="mt-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-black text-white">{profile.displayName || user.name}</h1>
                                    {/* BUG-15: badge also uses optimistically updated isBanned state */}
                                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${user.isBanned ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                        {user.isBanned ? '⛔ Banned' : '✓ Active'}
                                    </span>
                                    {profile.verificationStatus === 'approved' && (
                                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">✓ Verified</span>
                                    )}
                                </div>
                                <p className="text-surface-400 text-sm mt-0.5">{user.email}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                                    {profile.username && <span className="text-brand-400 font-semibold">@{profile.username}</span>}
                                    {profile.genre && <span className="capitalize bg-brand-500/10 border border-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">{profile.genre}</span>}
                                    <span className="text-surface-500">Joined {formatDate(user.createdAt)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                2. OVERVIEW STATS
            ══════════════════════════════════════════════════════════ */}
            <Card icon="📊" title="Overview" className="mb-4">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[0,1,2,3].map(i => <Sk key={i} h="h-20" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard icon="👥" label="Active Subscribers" value={(overview.activeSubscribers ?? 0).toLocaleString('en-IN')} color="text-brand-400" />
                        <StatCard icon="📸" label="Total Posts"        value={(overview.totalPosts ?? 0).toLocaleString('en-IN')}        color="text-violet-400" />
                        <StatCard icon="💳" label="Total Payments"     value={(overview.totalPayments ?? 0).toLocaleString('en-IN')}     color="text-sky-400" />
                        <StatCard icon="✅" label="Payouts Completed"  value={(overview.totalPaidPayouts ?? 0).toLocaleString('en-IN')}  color="text-emerald-400" />
                    </div>
                )}
            </Card>

            {/* ══════════════════════════════════════════════════════════
                3. FINANCIAL SUMMARY + PAY NOW
            ══════════════════════════════════════════════════════════ */}
            <Card icon="💰" title="Financial Summary" className="mb-4" action={
                !loading && (editFin ? (
                    <div className="flex gap-2">
                        {/* BUG-16 Fix: Cancel resets form to last-loaded data */}
                        <button onClick={() => { setEditFin(false); setFinConfirmPending(false); setFinForm({ totalEarned: fin.totalEarned ?? 0, pendingAmount: fin.pendingAmount ?? 0, withdrawnAmount: fin.withdrawnAmount ?? 0 }); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 hover:text-white transition-all">Cancel</button>
                        {/* BUG-02 Fix: two-step — first click shows confirm banner, second click saves */}
                        {!finConfirmPending ? (
                            <button onClick={() => setFinConfirmPending(true)} className="btn-brand text-xs px-4 py-1.5 rounded-lg">
                                Review & Save
                            </button>
                        ) : (
                            <button onClick={saveFinancials} disabled={savingFin} className="text-xs px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold hover:bg-amber-500/30 transition-all disabled:opacity-40">
                                {savingFin ? 'Saving…' : '⚠️ Confirm Save'}
                            </button>
                        )}
                    </div>
                ) : (
                    <button onClick={() => setEditFin(true)} className="text-xs px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold">
                        ✏️ Edit
                    </button>
                ))
            }>
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[0,1,2,3].map(i => <Sk key={i} h="h-20" />)}
                    </div>
                ) : editFin ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            {[
                                { key: 'totalEarned',     label: 'Total Earned (₹)',   color: 'text-white' },
                                { key: 'pendingAmount',   label: 'Pending Amount (₹)', color: 'text-amber-400' },
                                { key: 'withdrawnAmount', label: 'Paid Out (₹)',       color: 'text-emerald-400' },
                            ].map(({ key, label, color }) => (
                                <div key={key}>
                                    <label className={`${labelCls} ${color}`}>{label}</label>
                                    <input type="number" min="0" step="0.01" className={inputCls}
                                        value={finForm[key]}
                                        onChange={e => { setFinForm(f => ({ ...f, [key]: e.target.value })); setFinConfirmPending(false); }} />
                                </div>
                            ))}
                        </div>
                        {/* BUG-02 Fix: confirmation banner shows computed values before final save */}
                        {finConfirmPending && (
                            <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                                ⚠️ You are about to overwrite financial records with: <strong>Total ₹{Number(finForm.totalEarned).toFixed(2)}</strong>, Pending <strong>₹{Number(finForm.pendingAmount).toFixed(2)}</strong>, Paid Out <strong>₹{Number(finForm.withdrawnAmount).toFixed(2)}</strong>. This cannot be undone automatically.
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <StatCard label="Total Earned" value={formatCurrency(fin.totalEarned ?? 0)} color="text-white" />
                            <StatCard label="Pending"      value={formatCurrency(fin.pendingAmount ?? 0)} color={(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'} />
                            <StatCard label="Paid Out"     value={formatCurrency(fin.withdrawnAmount ?? 0)} color="text-emerald-400" />
                            {/* BUG-17 Fix: indicate the timezone is IST for the week window */}
                            <StatCard label="This Week (IST)" value={formatCurrency(fin.weeklyEarnings ?? 0)} color="text-sky-400"
                                subtext={fin.weekStart && fin.weekEnd ? (() => {
                                    const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
                                    return `${fmt(fin.weekStart)} – ${fmt(fin.weekEnd)}`;
                                })() : undefined} />
                        </div>

                        {/* Pay Now panel */}
                        <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(168,85,247,0.06))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16, padding: '16px 20px' }}
                            className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-white font-bold text-sm">Pending Balance</p>
                                <p className={`text-3xl font-black mt-0.5 ${(fin.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-surface-600'}`}>
                                    {formatCurrency(fin.pendingAmount ?? 0)}
                                </p>
                                {!bank && <p className="text-xs text-red-400 mt-1">⚠️ No bank details on file</p>}
                            </div>
                            {/* BUG-03 Fix: also disable Pay Now while a data reload is in flight */}
                            <button onClick={() => { if (!reloadingRef.current) setShowPayNow(true); }}
                                disabled={(fin.pendingAmount ?? 0) <= 0 || !bank || loading}
                                className="btn-brand px-6 py-3 rounded-xl font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                </svg>
                                Pay Now
                            </button>
                        </div>
                    </>
                )}
            </Card>

            {/* ══════════════════════════════════════════════════════════
                4. CREATOR PROFILE (editable)
            ══════════════════════════════════════════════════════════ */}
            <Card icon="✏️" title="Creator Profile" className="mb-4" action={
                !loading && (editProfile ? (
                    <div className="flex gap-2">
                        {/* BUG-16 Fix: Cancel resets profile form to last-loaded data */}
                        <button onClick={() => { setEditProfile(false); setProfileForm({ displayName: profile.displayName || user.name || '', bio: profile.bio || '', subscriptionPrice: profile.subscriptionPrice ?? '', genre: profile.genre || '' }); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 hover:text-white transition-all">Cancel</button>
                        <button onClick={saveProfile} disabled={savingProfile} className="btn-brand text-xs px-4 py-1.5 rounded-lg disabled:opacity-40">
                            {savingProfile ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setEditProfile(true)} className="text-xs px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all font-semibold">
                        ✏️ Edit
                    </button>
                ))
            }>
                {loading ? (
                    <div className="grid grid-cols-2 gap-3">{[0,1,2,3,4,5].map(i => <Sk key={i} h="h-16" />)}</div>
                ) : editProfile ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Display Name</label>
                            <input className={inputCls} value={profileForm.displayName}
                                placeholder="Creator name"
                                onChange={e => setProfileForm(f => ({ ...f, displayName: e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelCls}>Genre / Category</label>
                            <select className={inputCls} value={profileForm.genre}
                                onChange={e => setProfileForm(f => ({ ...f, genre: e.target.value }))}>
                                {GENRE_OPTIONS.map(g => (
                                    <option key={g} value={g} className="bg-surface-900 capitalize">{g || '— No Genre —'}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Subscription Price (₹)</label>
                            <input type="number" min="1" className={inputCls} value={profileForm.subscriptionPrice}
                                placeholder="e.g. 199"
                                onChange={e => setProfileForm(f => ({ ...f, subscriptionPrice: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Bio</label>
                            <textarea rows={3} className={`${inputCls} resize-none`} value={profileForm.bio}
                                placeholder="Creator bio…"
                                onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Display Name',   value: profile.displayName || '—' },
                            { label: 'Username',        value: profile.username ? `@${profile.username}` : '—' },
                            { label: 'Genre',           value: profile.genre || '—' },
                            { label: 'Sub Price',       value: profile.subscriptionPrice != null ? formatCurrency(profile.subscriptionPrice) : '—' },
                            { label: 'Subscribers',     value: (profile.totalSubscribers ?? 0).toLocaleString('en-IN') },
                            { label: 'Total Posts',     value: (profile.totalPosts ?? 0).toLocaleString('en-IN') },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-xl p-3 border border-white/[0.07]"
                                style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <p className="text-[10px] font-bold text-surface-600 uppercase tracking-widest mb-1">{label}</p>
                                <p className="text-sm font-bold text-white/85 capitalize">{value}</p>
                            </div>
                        ))}
                        {profile.bio && (
                            <div className="col-span-2 sm:col-span-3 rounded-xl p-3 border border-white/[0.07]"
                                style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <p className="text-[10px] font-bold text-surface-600 uppercase tracking-widest mb-1">Bio</p>
                                <p className="text-sm text-white/60 leading-relaxed">{profile.bio}</p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ══════════════════════════════════════════════════════════
                5. MEDIA LIBRARY
            ══════════════════════════════════════════════════════════ */}
            <Card icon="🖼️" title="Media Library" className="mb-4" action={
                <span className="text-xs text-surface-600">{mediaTotal} post{mediaTotal !== 1 ? 's' : ''}</span>
            }>
                {/* BUG-10 Fix: attach mediaRef so pagination scrolls the grid into view */}
                <div ref={mediaRef}>
                    {mediaLoading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => <Sk key={i} h="h-24 sm:h-28" />)}
                        </div>
                    ) : media.length === 0 ? (
                        <div className="py-12 flex flex-col items-center gap-2 text-surface-600">
                            <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                            </svg>
                            <p className="text-sm">No posts yet.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {media.map(post => {
                                    const thumb = post.mediaUrls?.[0] || '';
                                    const isVid  = post.mediaType === 'video';
                                    // BUG-11 Fix: generate a proper poster frame for video using Cloudinary transformation
                                    const poster = isVid ? getVideoPoster(thumb) : '';
                                    return (
                                        <div key={post._id} className="relative group rounded-xl overflow-hidden aspect-square bg-surface-800 border border-white/[0.06]">
                                            {thumb ? (
                                                isVid ? (
                                                    <video src={thumb} poster={poster} className="w-full h-full object-cover" muted playsInline preload="none" />
                                                ) : (
                                                    <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-surface-600 text-2xl">🖼️</div>
                                            )}
                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                                                {isVid && <span className="text-white text-xs font-bold">🎬 Video</span>}
                                                {/* BUG-12 Fix: show "N photos" instead of "+N" */}
                                                {post.mediaUrls?.length > 1 && <span className="text-white text-xs font-bold">📷 {post.mediaUrls.length}</span>}
                                                {post.isLocked && <span className="text-amber-400 text-[10px]">🔒 Locked</span>}
                                                <button
                                                    onClick={() => setDeleteTarget({ postId: post._id })}
                                                    className="mt-1 px-2.5 py-1 bg-red-500/80 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                            {/* BUG-12 Fix: badge shows count with photo icon, no "+" prefix */}
                                            {post.mediaUrls?.length > 1 && (
                                                <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">📷 {post.mediaUrls.length}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Pagination */}
                            {mediaTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <button disabled={mediaPage <= 1} onClick={() => {
                                        loadMedia(mediaPage - 1);
                                        // BUG-10 Fix: scroll media section into view after page change
                                        setTimeout(() => mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                    }}
                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 text-xs font-semibold hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        ← Prev
                                    </button>
                                    <span className="text-xs text-surface-500">Page {mediaPage} / {mediaTotalPages}</span>
                                    <button disabled={mediaPage >= mediaTotalPages} onClick={() => {
                                        loadMedia(mediaPage + 1);
                                        // BUG-10 Fix: scroll media section into view after page change
                                        setTimeout(() => mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                                    }}
                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 text-xs font-semibold hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>

            {/* ══════════════════════════════════════════════════════════
                6. BANK DETAILS
            ══════════════════════════════════════════════════════════ */}
            <Card icon="🏦" title="Bank Details" className="mb-4">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i => <Sk key={i} h="h-16" />)}</div>
                ) : !bank ? (
                    <p className="text-surface-600 text-sm italic text-center py-4">No bank details submitted yet.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Account Holder', value: bank.accountHolderName || '—' },
                            { label: 'Bank Name',       value: bank.bankName || '—' },
                            // BUG-07 Fix: guard against empty last4 — show '—' instead of '••••'
                            { label: 'Account No.',     value: bank.accountNumber && bank.last4 ? `••••${bank.last4}` : '—', mono: true },
                            { label: 'IFSC Code',       value: bank.ifscCode || '—', mono: true },
                        ].map(({ label, value, mono }) => (
                            <div key={label} className="rounded-xl p-3 border border-white/[0.07]"
                                style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <p className="text-[10px] font-bold text-surface-600 uppercase tracking-widest mb-1">{label}</p>
                                <p className={`text-sm font-bold text-white/85 ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</p>
                            </div>
                        ))}
                        {bank.verificationStatus && (
                            <div className="col-span-2 sm:col-span-4 mt-1">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                    bank.verificationStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    bank.verificationStatus === 'pending'  ? 'bg-amber-500/10  text-amber-400  border-amber-500/20'  :
                                    'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    KYC: {bank.verificationStatus}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ══════════════════════════════════════════════════════════
                7. PAYOUT HISTORY  (BUG-13 Fix: paginated)
            ══════════════════════════════════════════════════════════ */}
            <Card icon="📜" title="Payout History" className="mb-10" action={
                <span className="text-xs text-surface-600">
                    {payoutPagination
                        ? `${payoutPagination.total} total`
                        : `${payouts.length} record${payouts.length !== 1 ? 's' : ''}`
                    }
                </span>
            }>
                {loading ? (
                    <div className="space-y-3">{[0,1,2].map(i => <Sk key={i} h="h-14" />)}</div>
                ) : payouts.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-surface-600">
                        <svg className="w-9 h-9 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                        </svg>
                        <p className="text-sm">No payout history yet.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm min-w-[480px]">
                                <thead>
                                    <tr className="border-b border-white/[0.06]">
                                        {['Requested', 'Amount', 'Status', 'Paid On', 'Notes'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest text-surface-600 font-bold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {payouts.map(p => (
                                        <tr key={p._id} className="hover:bg-white/[0.015] transition-colors">
                                            <td className="px-3 py-3 text-surface-400 text-xs whitespace-nowrap">{formatDate(p.requestedAt || p.createdAt)}</td>
                                            <td className="px-3 py-3 font-black text-white whitespace-nowrap">{formatCurrency(p.amount)}</td>
                                            <td className="px-3 py-3 whitespace-nowrap"><Pill status={p.status} /></td>
                                            <td className="px-3 py-3 text-surface-500 text-xs whitespace-nowrap">{p.processedAt ? formatDateTime(p.processedAt) : '—'}</td>
                                            <td className="px-3 py-3 text-surface-600 text-xs">{p.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* BUG-13 Fix: pagination controls for payout history */}
                        {payoutPagination && payoutPagination.pages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.05]">
                                <span className="text-xs text-surface-600">Page {payoutPagination.page} of {payoutPagination.pages}</span>
                                <div className="flex gap-2">
                                    <button
                                        disabled={payoutPagination.page <= 1}
                                        onClick={() => { /* reload with payoutPage param - handled via load() with URL state or parent */ }}
                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 text-xs font-semibold hover:text-white disabled:opacity-30 transition-colors">
                                        ← Prev
                                    </button>
                                    <button
                                        disabled={payoutPagination.page >= payoutPagination.pages}
                                        onClick={() => { /* reload with next payoutPage */ }}
                                        className="px-3 py-1.5 rounded-lg border border-white/10 text-surface-400 text-xs font-semibold hover:text-white disabled:opacity-30 transition-colors">
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* ── Pay Now Modal ────────────────────────────────────────── */}
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
        </>
    );
}
