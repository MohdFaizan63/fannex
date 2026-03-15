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

// ── Bank Details Panel ────────────────────────────────────────────────────────
function BankDetailsPanel({ bank, proofOpen, onToggleProof }) {
    if (!bank) {
        return (
            <div style={{
                padding: '14px 20px',
                background: 'rgba(255,255,255,0.015)',
                borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12.5, margin: 0, fontStyle: 'italic' }}>
                    ⚠️ No bank details on file for this creator.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            padding: 'clamp(14px,3vw,20px)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(168,85,247,0.03))',
            borderTop: '1px solid rgba(124,58,237,0.15)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 14 }}>🏦</span>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Bank Account Details
                </p>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Details grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
                marginBottom: bank.bankProofImageUrl ? 14 : 0,
            }}>
                {[
                    { label: 'Account Holder', value: bank.accountHolderName || '—' },
                    { label: 'Bank Name', value: bank.bankName || '—' },
                    { label: 'Account Number', value: bank.accountNumber ? `••••${bank.last4}` : '—', full: bank.accountNumber },
                    { label: 'IFSC Code', value: bank.ifscCode || '—' },
                ].map(({ label, value, full }) => (
                    <BankDetailCell key={label} label={label} value={value} fullValue={full} />
                ))}
            </div>

            {/* Proof image */}
            {bank.bankProofImageUrl && (
                <div>
                    <button
                        onClick={onToggleProof}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 9,
                            background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.28)',
                            color: '#c4b5fd', fontSize: 12.5, fontWeight: 600,
                            cursor: 'pointer', marginBottom: proofOpen ? 12 : 0,
                            transition: 'all 0.15s',
                        }}
                    >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {proofOpen ? 'Hide' : 'View'} Bank Proof
                    </button>
                    {proofOpen && (
                        <a href={bank.bankProofImageUrl} target="_blank" rel="noopener noreferrer">
                            <img
                                src={bank.bankProofImageUrl}
                                alt="Bank proof document"
                                style={{
                                    maxWidth: '100%', maxHeight: 280, borderRadius: 12,
                                    border: '1px solid rgba(124,58,237,0.25)',
                                    objectFit: 'contain',
                                }}
                            />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function BankDetailCell({ label, value, fullValue }) {
    const [revealed, setRevealed] = useState(false);
    const displayVal = revealed && fullValue ? fullValue : value;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            padding: '9px 12px',
        }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', margin: 0, letterSpacing: label === 'IFSC Code' ? '0.04em' : 0 }}>
                    {displayVal}
                </p>
                {fullValue && (
                    <button
                        onClick={() => setRevealed(r => !r)}
                        style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}
                    >
                        {revealed ? '[ hide ]' : '[ show ]'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Expandable payout row ─────────────────────────────────────────────────────
function PayoutRow({ payout, onApprove, onMarkPaid, onReject, actionLoading }) {
    const [expanded, setExpanded] = useState(false);
    const [proofOpen, setProofOpen] = useState(false);
    const creator = payout.creatorId ?? {};

    return (
        <>
            <tr
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => setExpanded(v => !v)}
            >
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
                    {formatCurrency(payout.amount)}
                </td>

                {/* Status */}
                <td className="px-5 py-4">
                    <StatusPill status={payout.status} />
                </td>

                {/* Requested date */}
                <td className="px-5 py-4 text-surface-400 text-xs">
                    {formatDate(payout.requestedAt ?? payout.createdAt)}
                </td>

                {/* Bank indicator */}
                <td className="px-5 py-4">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {payout.bankDetails ? (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 99,
                                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                                color: '#4ade80', fontSize: 11, fontWeight: 700,
                            }}>
                                ✓ ••••{payout.bankDetails.last4}
                            </span>
                        ) : (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 99,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                color: '#f87171', fontSize: 11, fontWeight: 700,
                            }}>
                                ✕ No bank
                            </span>
                        )}
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                            {expanded ? '▲' : '▼'}
                        </span>
                    </div>
                </td>

                {/* Actions */}
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <ActionCell
                        payout={payout}
                        onApprove={onApprove}
                        onMarkPaid={onMarkPaid}
                        onReject={onReject}
                        actionLoading={actionLoading}
                    />
                </td>
            </tr>

            {/* ── Expanded bank details row ─────────────────────── */}
            {expanded && (
                <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                        <BankDetailsPanel
                            bank={payout.bankDetails}
                            proofOpen={proofOpen}
                            onToggleProof={() => setProofOpen(v => !v)}
                        />
                    </td>
                </tr>
            )}
        </>
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
        <div className="p-4 sm:p-6 max-w-6xl">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-white">💸 Payouts</h1>
                <p className="text-surface-400 mt-1 text-sm">
                    Manage creator payout requests. Click any row to view full bank details.
                </p>
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
                                        {['Creator', 'Amount', 'Status', 'Requested', 'Bank Account', 'Actions'].map((h) => (
                                            <th key={h}
                                                className={`px-5 py-3 text-xs uppercase tracking-widest text-surface-500 font-semibold ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payouts.map((p) => (
                                        <PayoutRow
                                            key={p._id}
                                            payout={p}
                                            onApprove={onApprove}
                                            onMarkPaid={onMarkPaid}
                                            onReject={onReject}
                                            actionLoading={actionLoading}
                                        />
                                    ))}
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
