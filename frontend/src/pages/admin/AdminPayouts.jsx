import { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/adminService';
import Pagination from '../../components/Pagination';
import { Loader, ErrorMessage, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';

// ── Status pill ───────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
    paid: 'bg-green-500/20  text-green-400  border-green-500/30',
    rejected: 'bg-red-500/20   text-red-400    border-red-500/30',
};

function StatusPill({ status }) {
    return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLES[status] ?? 'bg-surface-700 text-surface-400 border-transparent'}`}>
            {status}
        </span>
    );
}

// ── Reject reason mini-modal ──────────────────────────────────────────────────
function RejectPopover({ id, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    return (
        <div className="absolute right-0 top-full mt-2 z-40 w-72 glass rounded-xl border border-white/10 p-4 shadow-2xl animate-fade-in-up">
            <p className="text-sm font-medium text-white mb-2">Rejection reason</p>
            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required — explain the rejection…"
                rows={3}
                className="input-dark w-full resize-none text-xs"
                autoFocus
            />
            <div className="flex gap-2 mt-3">
                <button onClick={onCancel}
                    className="btn-outline flex-1 py-1.5 text-xs">Cancel</button>
                <button
                    onClick={() => reason.trim() && onConfirm(id, reason.trim())}
                    disabled={!reason.trim()}
                    className="flex-1 py-1.5 text-xs rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40">
                    Reject
                </button>
            </div>
        </div>
    );
}

// ── Action cell ───────────────────────────────────────────────────────────────
function ActionCell({ payout, onApprove, onMarkPaid, onReject, actionLoading }) {
    const [showReject, setShowReject] = useState(false);
    const ref = useRef();
    const busy = actionLoading === payout._id;
    const status = payout.status;

    // Close popover on outside click
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowReject(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div className="relative flex items-center gap-2 justify-end" ref={ref}>
            {busy && <span className="text-xs text-surface-500">…</span>}

            {status === 'pending' && !busy && (
                <>
                    <button onClick={() => onApprove(payout._id)}
                        className="btn-brand text-xs px-3 py-1.5 rounded-lg">
                        Approve
                    </button>
                    <button onClick={() => setShowReject((v) => !v)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                        Reject
                    </button>
                </>
            )}

            {status === 'approved' && !busy && (
                <button onClick={() => onMarkPaid(payout._id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all">
                    Mark Paid
                </button>
            )}

            {(status === 'paid' || status === 'rejected') && (
                <span className="text-surface-600 text-xs">—</span>
            )}

            {showReject && (
                <RejectPopover
                    id={payout._id}
                    onCancel={() => setShowReject(false)}
                    onConfirm={(id, reason) => { setShowReject(false); onReject(id, reason); }}
                />
            )}
        </div>
    );
}

// ── Main AdminPayouts page ────────────────────────────────────────────────────
const FILTER_TABS = ['all', 'pending', 'approved', 'paid', 'rejected'];
const LIMIT = 20;

export default function AdminPayouts() {
    const [payouts, setPayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('pending');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotal] = useState(0);
    const [actionLoading, setActionLoading] = useState(null);
    const [toast, setToast] = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 4000);
    };

    const load = async (status, pg) => {
        setLoading(true);
        setError('');
        try {
            const params = { page: pg, limit: LIMIT, sort: '-requestedAt' };
            if (status !== 'all') params.status = status;
            const { data } = await adminService.getPayouts(params);
            setPayouts(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotal(data.totalResults ?? 0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(filter, page); }, [filter, page]);

    const handleFilterChange = (f) => { setFilter(f); setPage(1); };
    const handlePageChange = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    // ── Actions ────────────────────────────────────────────────────────────────
    const doAction = async (fn, id, extra, successMsg) => {
        setActionLoading(id);
        try {
            await fn(id, extra);
            showToast(successMsg);
            // Optimistically update status in place
            setPayouts((prev) => prev.map((p) => {
                if (p._id !== id) return p;
                const nextStatus = successMsg.includes('Approved') ? 'approved'
                    : successMsg.includes('Paid') ? 'paid'
                        : successMsg.includes('Rejected') ? 'rejected'
                            : p.status;
                return { ...p, status: nextStatus };
            }));
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setActionLoading(null);
        }
    };

    const onApprove = (id) => doAction(adminService.approvePayout, id, undefined, 'Approved payout ✓');
    const onMarkPaid = (id) => doAction(adminService.markPaid, id, undefined, 'Marked as Paid ✓');
    const onReject = (id, reason) => doAction(adminService.rejectPayout, id, reason, 'Rejected payout ✓');

    return (
        <div className="p-6 max-w-6xl">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">💸 Payouts</h1>
                <p className="text-surface-400 mt-1">Manage creator payout requests.</p>
            </div>

            {/* Toast */}
            {toast && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    {toast}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-5">
                    <ErrorMessage message={error} onRetry={() => load(filter, page)} />
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-7">
                {FILTER_TABS.map((f) => (
                    <button key={f} onClick={() => handleFilterChange(f)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${filter === f ? 'btn-brand' : 'glass border border-white/10 text-surface-300 hover:text-white hover:border-brand-500/30'
                            }`}>
                        {f}
                        {filter === f && !loading && (
                            <span className="ml-1.5 text-xs opacity-70">({totalResults})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Table ─────────────────────────────────────────────────────────── */}
            {loading ? (
                <Loader text="Loading payouts…" />
            ) : payouts.length === 0 ? (
                <EmptyState emoji="📭" title={`No ${filter === 'all' ? '' : filter} payouts`}
                    description="Nothing to show here right now." />
            ) : (
                <>
                    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {['Creator', 'Amount', 'Status', 'Requested', 'Actions'].map((h) => (
                                            <th key={h}
                                                className={`px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payouts.map((p) => {
                                        const creator = p.creatorId ?? {};
                                        return (
                                            <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">

                                                {/* Creator */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                            {creator.name?.charAt(0)?.toUpperCase() ?? 'C'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white font-medium text-sm truncate max-w-[140px]">{creator.name ?? '—'}</p>
                                                            <p className="text-surface-500 text-xs truncate max-w-[140px]">{creator.email ?? ''}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Amount */}
                                                <td className="px-5 py-4 font-bold text-white text-base">
                                                    {formatCurrency(p.amount)}
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    <StatusPill status={p.status} />
                                                </td>

                                                {/* Requested date */}
                                                <td className="px-5 py-4 text-surface-400 text-xs">
                                                    {formatDate(p.requestedAt ?? p.createdAt)}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-5 py-4">
                                                    <ActionCell
                                                        payout={p}
                                                        onApprove={onApprove}
                                                        onMarkPaid={onMarkPaid}
                                                        onReject={onReject}
                                                        actionLoading={actionLoading}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        className="mt-8"
                    />
                </>
            )}
        </div>
    );
}
