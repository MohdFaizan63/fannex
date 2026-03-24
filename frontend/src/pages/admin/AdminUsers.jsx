import { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../../services/adminService';
import { formatDate, getErrorMessage } from '../../utils/helpers';

// ── Constants ─────────────────────────────────────────────────────────────────
const LIMIT = 20;
const DEBOUNCE_MS = 400;

function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

// ── Confirm Delete Modal with timer ──────────────────────────────────────────
function DeleteConfirmModal({ user, onConfirm, onCancel, busy }) {
    const [countdown, setCountdown] = useState(5);
    const firstBtnRef = useRef();
    const confirmBtnRef = useRef();

    useEffect(() => { firstBtnRef.current?.focus(); }, []);
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    // Focus trap
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !busy) onCancel();
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === firstBtnRef.current) { e.preventDefault(); confirmBtnRef.current?.focus(); }
        } else {
            if (document.activeElement === confirmBtnRef.current) { e.preventDefault(); firstBtnRef.current?.focus(); }
        }
    };

    const label = user.role === 'creator' ? 'creator' : 'user';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-modal-title"
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
            <div className="bg-surface-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                {/* Warning icon */}
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                </div>

                <h3 id="delete-user-modal-title" className="text-white font-black text-center text-lg mb-1">
                    Delete {label}?
                </h3>
                <p className="text-surface-400 text-sm text-center mb-2">
                    <span className="text-white font-semibold">{user.displayName || user.name}</span>
                    <span className="text-surface-500 text-xs block mt-0.5">{user.email}</span>
                </p>

                {/* Danger list */}
                <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 mb-5 text-xs text-red-300 space-y-1">
                    <p className="font-bold text-red-400 mb-1.5">⚠️ This will permanently delete:</p>
                    <p>• All posts, media files (Cloudinary), comments, likes</p>
                    <p>• Subscriptions, payments, chat history</p>
                    <p>• Earnings, payout records, notifications</p>
                    {user.role === 'creator' && <p>• Creator profile, KYC data, Dream Fund goals</p>}
                    <p className="mt-1.5 text-red-400 font-semibold">This action CANNOT be undone.</p>
                </div>

                <div className="flex gap-3">
                    <button
                        ref={firstBtnRef}
                        onClick={onCancel}
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-surface-400 text-sm font-semibold hover:text-white transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        ref={confirmBtnRef}
                        onClick={onConfirm}
                        disabled={busy || countdown > 0}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
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

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ isBanned }) {
    return isBanned ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />Suspended
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />Active
        </span>
    );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
    const s = role === 'creator' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
              role === 'admin'   ? 'bg-amber-500/10  text-amber-400  border-amber-500/20'  :
                                  'bg-surface-700   text-surface-400 border-white/10';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${s}`}>
            {role}
        </span>
    );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ cols }) {
    return (
        <tr>
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                    <div><div className="skeleton h-3.5 w-28 mb-1.5 rounded" /><div className="skeleton h-3 w-36 rounded" /></div>
                </div>
            </td>
            {Array.from({ length: cols - 1 }).map((_, i) => (
                <td key={i} className="px-5 py-4"><div className="skeleton h-3.5 w-16 rounded" /></td>
            ))}
        </tr>
    );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
    const s = type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    return msg ? (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm border flex items-center gap-2 ${s}`}>
            <span>{type === 'error' ? '✗' : '✓'}</span>{msg}
        </div>
    ) : null;
}

// ── Main AdminUsers Page ──────────────────────────────────────────────────────
const ROLE_TABS = [
    { label: 'All', value: '' },
    { label: 'Users', value: 'user' },
    { label: 'Creators', value: 'creator' },
];

export default function AdminUsers() {
    const [users,        setUsers]       = useState([]);
    const [loading,      setLoading]     = useState(true);
    const [error,        setError]       = useState('');
    const [search,       setSearch]      = useState('');
    const [roleFilter,   setRoleFilter]  = useState('');
    const [sort,         setSort]        = useState('-createdAt');
    const [page,         setPage]        = useState(1);
    const [totalPages,   setTotalPages]  = useState(1);
    const [totalResults, setTotalResults]= useState(0);
    const [toast,        setToast]       = useState({ msg: '', type: 'success' });
    const [deleteTarget, setDeleteTarget]= useState(null); // user object to delete
    const [deleteBusy,   setDeleteBusy]  = useState(false);
    const [banBusy,      setBanBusy]     = useState(null); // user id being banned

    const toastTimerRef = useRef(null);
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
            const { data } = await adminService.getUsers(params);
            setUsers(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotalResults(data.total ?? data.totalResults ?? 0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load({ search: debouncedSearch, role: roleFilter || undefined, sort, page, limit: LIMIT });
    }, [debouncedSearch, roleFilter, sort, page, load]);

    const handleToggleBan = async (user) => {
        setBanBusy(user._id);
        // Optimistic update
        setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isBanned: !u.isBanned } : u));
        try {
            if (user.isBanned) await adminService.unbanUser(user._id);
            else               await adminService.banUser(user._id);
            flash(`${user.name} ${user.isBanned ? 'unbanned' : 'banned'} ✓`);
        } catch (err) {
            // Revert
            setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isBanned: user.isBanned } : u));
            flash(getErrorMessage(err), 'error');
        } finally {
            setBanBusy(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            if (deleteTarget.role === 'creator') {
                await adminService.deleteCreator(deleteTarget._id);
            } else {
                await adminService.deleteUser(deleteTarget._id);
            }
            flash(`${deleteTarget.name || deleteTarget.email} permanently deleted. All data removed.`);
            setDeleteTarget(null);
            // Remove from list immediately
            setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
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
                    user={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => !deleteBusy && setDeleteTarget(null)}
                    busy={deleteBusy}
                />
            )}

            <div className="p-4 sm:p-6 max-w-7xl">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-black text-white">👥 User Management</h1>
                    <p className="text-surface-400 mt-1 text-sm">Manage all users and creators — ban, unban, or permanently delete accounts.</p>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by name or email…"
                            className="input-dark w-full pl-9 text-sm"
                        />
                    </div>

                    {/* Role filter */}
                    <div className="flex gap-2 flex-wrap">
                        {ROLE_TABS.map(r => (
                            <button
                                key={r.value}
                                onClick={() => { setRoleFilter(r.value); setPage(1); }}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                                    roleFilter === r.value ? 'btn-brand' : 'glass border border-white/10 text-surface-300 hover:text-white hover:border-brand-500/30'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Sort */}
                    <select
                        value={sort}
                        onChange={(e) => { setSort(e.target.value); setPage(1); }}
                        className="input-dark text-sm py-1.5 px-3 sm:w-auto"
                    >
                        <option value="-createdAt">Newest first</option>
                        <option value="createdAt">Oldest first</option>
                        <option value="name">Name A→Z</option>
                        <option value="-name">Name Z→A</option>
                    </select>

                    {!loading && (
                        <span className="text-xs text-surface-500 ml-auto whitespace-nowrap">
                            {totalResults.toLocaleString('en-IN')} account{totalResults !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                <Toast msg={toast.msg} type={toast.type} />
                {error && <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

                {/* Table */}
                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">User</th>
                                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">Role</th>
                                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">Joined</th>
                                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-left">Status</th>
                                    <th className="px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {loading
                                    ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                                    : users.length === 0
                                        ? (
                                            <tr>
                                                <td colSpan={5} className="py-16 text-center text-surface-500">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                                                        </svg>
                                                        <p className="text-sm">No users found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                        : users.map(u => {
                                            const initials = (u.name || u.email || '?')[0].toUpperCase();
                                            const isAdmin = u.role === 'admin';
                                            return (
                                                <tr key={u._id} className="hover:bg-white/[0.02] transition-colors group">
                                                    {/* Identity */}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-3">
                                                            {u.profileImage ? (
                                                                <img src={u.profileImage} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                                                    {initials}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-white font-semibold text-sm truncate max-w-[180px]">{u.name || '—'}</p>
                                                                <p className="text-surface-500 text-xs truncate max-w-[180px]">{u.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* Role */}
                                                    <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                                                    {/* Joined */}
                                                    <td className="px-5 py-3.5 text-surface-400 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                                                    {/* Status */}
                                                    <td className="px-5 py-3.5"><StatusBadge isBanned={u.isBanned} /></td>
                                                    {/* Actions */}
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {/* Ban / Unban */}
                                                            {!isAdmin && (
                                                                <button
                                                                    onClick={() => handleToggleBan(u)}
                                                                    disabled={banBusy === u._id}
                                                                    title={u.isBanned ? 'Unban user' : 'Ban user'}
                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 ${
                                                                        u.isBanned
                                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                                                                    }`}
                                                                >
                                                                    {banBusy === u._id ? '…' : u.isBanned ? '✓ Unban' : '⛔ Ban'}
                                                                </button>
                                                            )}
                                                            {/* Delete — not for admin accounts */}
                                                            {!isAdmin && (
                                                                <button
                                                                    onClick={() => setDeleteTarget(u)}
                                                                    title="Permanently delete account and all data"
                                                                    className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {isAdmin && (
                                                                <span className="text-xs text-surface-600 italic">Admin account</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                }
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 px-1">
                        <span className="text-xs text-surface-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30">← Prev</button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30">Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
