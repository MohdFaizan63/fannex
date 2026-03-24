import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';

// ── Constants ─────────────────────────────────────────────────────────────────
const LIMIT = 20;
const DEBOUNCE_MS = 400;

// ── Helpers ───────────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (
        <tr>
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                    <div>
                        <div className="skeleton h-3.5 w-28 mb-1.5 rounded" />
                        <div className="skeleton h-3 w-36 rounded" />
                    </div>
                </div>
            </td>
            {[1, 2, 3, 4].map((i) => (
                <td key={i} className="px-5 py-4"><div className="skeleton h-3.5 w-20 rounded" /></td>
            ))}
            <td className="px-5 py-4"><div className="skeleton h-6 w-16 rounded-full" /></td>
            <td className="px-5 py-4"><div className="skeleton h-7 w-7 rounded-lg" /></td>
        </tr>
    );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ isBanned }) {
    return isBanned ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Suspended
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Active
        </span>
    );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
function FilterTab({ active, label, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                active
                    ? 'btn-brand'
                    : 'glass border border-white/10 text-surface-300 hover:text-white hover:border-brand-500/30'
            }`}
        >
            {label}
        </button>
    );
}

// ── Sort column header ────────────────────────────────────────────────────────
function SortTh({ label, field, currentSort, onSort }) {
    const active = currentSort === field || currentSort === `-${field}`;
    const isDesc = currentSort === `-${field}`;
    return (
        <th
            onClick={() => onSort(active && !isDesc ? `-${field}` : field)}
            className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left cursor-pointer select-none hover:text-white transition-colors"
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {active && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        {isDesc
                            ? <path d="M7 14l5-5 5 5H7z" />
                            : <path d="M7 10l5 5 5-5H7z" />}
                    </svg>
                )}
            </span>
        </th>
    );
}

// ── Confirm Delete Modal (reusable, with 5s countdown) ───────────────────────
function DeleteConfirmModal({ creator, onConfirm, onCancel, busy }) {
    const [countdown, setCountdown] = useState(5);
    const cancelRef  = useRef();
    const confirmRef = useRef();

    useEffect(() => { cancelRef.current?.focus(); }, []);
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !busy) onCancel();
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === cancelRef.current) { e.preventDefault(); confirmRef.current?.focus(); }
        } else {
            if (document.activeElement === confirmRef.current) { e.preventDefault(); cancelRef.current?.focus(); }
        }
    };

    return (
        <div role="dialog" aria-modal="true" onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-surface-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                </div>
                <h3 className="text-white font-black text-center text-lg mb-1">Delete Creator?</h3>
                <p className="text-surface-400 text-sm text-center mb-2">
                    <span className="text-white font-semibold">{creator.displayName || creator.name}</span>
                    <span className="text-surface-500 text-xs block mt-0.5">{creator.email}</span>
                </p>
                <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 mb-5 text-xs text-red-300 space-y-1">
                    <p className="font-bold text-red-400 mb-1.5">⚠️ This will permanently delete:</p>
                    <p>• All posts, media (Cloudinary), comments, likes</p>
                    <p>• Subscriptions, payments, chat history</p>
                    <p>• Earnings, payouts, KYC data, Dream Fund goals</p>
                    <p className="mt-1.5 text-red-400 font-semibold">This CANNOT be undone.</p>
                </div>
                <div className="flex gap-3">
                    <button ref={cancelRef} onClick={onCancel} disabled={busy}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-surface-400 text-sm font-semibold hover:text-white transition-colors disabled:opacity-40">Cancel</button>
                    <button ref={confirmRef} onClick={onConfirm} disabled={busy || countdown > 0}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {busy ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                Deleting…
                            </span>
                        ) : countdown > 0 ? `Delete (${countdown}s)` : '🗑️ Confirm Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Creator Row ───────────────────────────────────────────────────────────────
function CreatorRow({ creator, onClick, onDelete }) {
    const initials = (creator.displayName || creator.name || '?')[0].toUpperCase();
    const hasPending = creator.pendingAmount > 0;

    return (
        <tr
            onClick={() => onClick(creator)}
            className="hover:bg-white/[0.025] transition-colors cursor-pointer group"
        >
            {/* Creator identity */}
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    {creator.profileImage ? (
                        <img
                            src={creator.profileImage}
                            alt={creator.displayName}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {initials}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate max-w-[160px] group-hover:text-brand-300 transition-colors">
                            {creator.displayName || creator.name}
                        </p>
                        <p className="text-surface-500 text-xs truncate max-w-[160px]">{creator.email}</p>
                        {creator.username && (
                            <p className="text-surface-600 text-[11px]">@{creator.username}</p>
                        )}
                    </div>
                </div>
            </td>

            {/* Subscribers */}
            <td className="px-5 py-4 text-surface-300 text-sm font-medium">
                {creator.totalSubscribers.toLocaleString('en-IN')}
            </td>

            {/* Total Earned */}
            <td className="px-5 py-4 text-white text-sm font-bold">
                {formatCurrency(creator.totalEarned)}
            </td>

            {/* Pending Balance */}
            <td className="px-5 py-4">
                <span className={`text-sm font-bold ${hasPending ? 'text-amber-400' : 'text-surface-600'}`}>
                    {formatCurrency(creator.pendingAmount)}
                </span>
            </td>

            {/* Total Paid */}
            <td className="px-5 py-4 text-emerald-400 text-sm font-medium">
                {formatCurrency(creator.withdrawnAmount)}
            </td>

            {/* Status */}
            <td className="px-5 py-4"><StatusBadge isBanned={creator.isBanned} /></td>

            {/* Open arrow */}
            <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 justify-end">
                    {/* Delete button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(creator); }}
                        title="Permanently delete creator and all their data"
                        className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                    </button>
                    {/* Navigate arrow */}
                    <span className="text-surface-600 group-hover:text-brand-400 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </td>
        </tr>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between mt-6 px-1">
            <span className="text-xs text-surface-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
                <button
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30"
                >← Prev</button>
                <button
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30"
                >Next →</button>
            </div>
        </div>
    );
}

// ── Main AdminCreators Page ───────────────────────────────────────────────────
const FILTER_TABS = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Suspended', value: 'suspended' },
];

export default function AdminCreators() {
    const navigate = useNavigate();
    const [creators, setCreators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('-createdAt');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [toast, setToast] = useState({ msg: '', type: 'success' });
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const toastTimerRef = useRef();

    const flash = (msg, type = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ msg, type });
        toastTimerRef.current = setTimeout(() => setToast({ msg: '', type: 'success' }), 5000);
    };
    useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

    const debouncedSearch = useDebounce(search, DEBOUNCE_MS);

    const load = useCallback(async (params) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await adminService.getCreators(params);
            setCreators(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotalResults(data.totalResults ?? 0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load({ search: debouncedSearch, status, sort, page, limit: LIMIT });
    }, [debouncedSearch, status, sort, page, load]);

    const handleStatusChange = (s) => { setStatus(s); setPage(1); };
    const handleSort = (s) => { setSort(s); setPage(1); };
    const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await adminService.deleteCreator(deleteTarget._id);
            flash(`${deleteTarget.displayName || deleteTarget.name} permanently deleted ✓`);
            setDeleteTarget(null);
            setCreators(prev => prev.filter(c => c._id !== deleteTarget._id));
            setTotalResults(prev => Math.max(0, prev - 1));
        } catch (err) {
            flash(getErrorMessage(err), 'error');
        } finally {
            setDeleteBusy(false);
        }
    };

    return (
        <>
            {deleteTarget && (
                <DeleteConfirmModal
                    creator={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => !deleteBusy && setDeleteTarget(null)}
                    busy={deleteBusy}
                />
            )}

            <div className="p-4 sm:p-6 max-w-7xl">

            {/* Toast */}
            {toast.msg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${
                    toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                    <span>{toast.type === 'error' ? '✗' : '✓'}</span>{toast.msg}
                </div>
            )}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-white">👩‍🎨 Creators</h1>
                <p className="text-surface-400 mt-1 text-sm">
                    View all creators, their earnings, and manage payouts directly.
                </p>
            </div>


            {/* ── Controls ───────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={handleSearch}
                        placeholder="Search by name or email…"
                        className="input-dark w-full pl-9 text-sm"
                    />
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-2 flex-wrap">
                    {FILTER_TABS.map((f) => (
                        <FilterTab
                            key={f.value}
                            label={f.label}
                            active={status === f.value}
                            onClick={() => handleStatusChange(f.value)}
                        />
                    ))}
                </div>

                {/* Total count */}
                {!loading && (
                    <span className="text-xs text-surface-500 ml-auto whitespace-nowrap">
                        {totalResults.toLocaleString('en-IN')} creator{totalResults !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* ── Error ──────────────────────────────────────────────────── */}
            {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* ── Table ──────────────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">Creator</th>
                                <SortTh label="Subscribers" field="totalSubscribers" currentSort={sort} onSort={handleSort} />
                                <SortTh label="Total Earned" field="totalEarned" currentSort={sort} onSort={handleSort} />
                                <SortTh label="Pending" field="pendingAmount" currentSort={sort} onSort={handleSort} />
                                <SortTh label="Total Paid" field="withdrawnAmount" currentSort={sort} onSort={handleSort} />
                                <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">Status</th>
                                <th className="px-5 py-3 w-10" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {loading
                                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                                : creators.length === 0
                                    ? (
                                        <tr>
                                            <td colSpan={7} className="py-20 text-center text-surface-500">
                                                <div className="flex flex-col items-center gap-3">
                                                    <svg className="w-12 h-12 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                                                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                                                    </svg>
                                                    <p className="text-sm">No creators found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                    : creators.map((c) => (
                                        <CreatorRow
                                            key={c._id}
                                            creator={c}
                                            onClick={(cr) => navigate(`/admin/creators/${cr._id}`)}
                                            onDelete={(cr) => setDeleteTarget(cr)}
                                        />
                                    ))
                            }
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        </div>
    </>
    );
}
