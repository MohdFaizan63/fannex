import { useState, useEffect, useRef, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { formatDate, getErrorMessage } from '../../utils/helpers';

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
    close:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    eye:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    check:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
    x:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>,
    doc:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    shield:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
    bank:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h1v11M19 10h1v11M8 10h2v11M14 10h2v11"/></svg>,
    user:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
    spinner: <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>,
    empty:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 opacity-20"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    link:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>,
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
    { key: 'pending',  label: 'Pending',  color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30'  },
    { key: 'approved', label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    { key: 'rejected', label: 'Rejected', color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30'      },
];

const STATUS_CONFIG = {
    pending:  { label: 'Pending Review', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',    dot: 'bg-amber-400' },
    approved: { label: 'Approved',       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
    rejected: { label: 'Rejected',       cls: 'bg-red-500/15 text-red-400 border-red-500/30',          dot: 'bg-red-400'     },
};

// ─── Document Lightbox ────────────────────────────────────────────────────────
function DocLightbox({ url, label, onClose }) {
    const overlayRef = useRef();

    useEffect(() => {
        const handler = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const isPdf = url?.includes('.pdf') || url?.includes('pdf');

    return (
        <div
            ref={overlayRef}
            onClick={(e) => e.target === overlayRef.current && onClose()}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4"
        >
            <div className="w-full max-w-3xl animate-fade-in-up">
                {/* Lightbox header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                            {Icons.doc}
                        </div>
                        <p className="font-semibold text-white text-sm">{label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-brand-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-brand-500/10 border border-transparent hover:border-brand-500/20"
                        >
                            {Icons.link} Open original
                        </a>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-surface-800 hover:bg-surface-700 border border-white/10 text-surface-400 hover:text-white flex items-center justify-center transition-all"
                        >
                            {Icons.close}
                        </button>
                    </div>
                </div>

                {/* Document */}
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-surface-900 shadow-2xl">
                    {isPdf ? (
                        <iframe src={url} className="w-full h-[75vh]" title={label} />
                    ) : (
                        <img
                            src={url} alt={label}
                            className="w-full max-h-[75vh] object-contain"
                            onError={(e) => { e.target.src = ''; e.target.alt = 'Failed to load image'; }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose, creatorName }) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const textRef = useRef();

    useEffect(() => {
        textRef.current?.focus();
        const handler = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const QUICK_REASONS = [
        'Documents are blurry or unreadable',
        'Name mismatch between documents',
        'PAN or Aadhaar number invalid',
        'Bank details do not match',
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="glass rounded-2xl p-6 w-full max-w-md border border-red-500/20 animate-fade-in-up shadow-2xl">
                {/* Header */}
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400 flex-shrink-0">
                        {Icons.x}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Reject Verification</h3>
                        {creatorName && (
                            <p className="text-xs text-surface-400 mt-0.5">Rejecting: <span className="text-surface-200">{creatorName}</span></p>
                        )}
                    </div>
                    <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white flex items-center justify-center transition-all border border-white/5">
                        {Icons.close}
                    </button>
                </div>

                {/* Quick reason chips */}
                <p className="text-xs text-surface-500 mb-2 font-medium">Quick reasons</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {QUICK_REASONS.map((r) => (
                        <button
                            key={r}
                            onClick={() => { setReason(r); setError(''); }}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${reason === r ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-surface-800 border-white/8 text-surface-400 hover:text-surface-200 hover:border-white/15'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* Custom reason textarea */}
                <p className="text-xs text-surface-500 mb-2 font-medium">Custom reason</p>
                <textarea
                    ref={textRef}
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(''); }}
                    placeholder="Provide a clear, specific rejection reason that the creator will see…"
                    rows={3}
                    className="input-dark w-full resize-none text-sm"
                />
                {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="btn-outline flex-1 py-2.5 text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (!reason.trim()) { setError('Please provide a rejection reason.'); return; }
                            onConfirm(reason.trim());
                        }}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 hover:border-red-500/60 transition-all"
                    >
                        Confirm Reject
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Document Button ──────────────────────────────────────────────────────────
function DocButton({ label, url, icon }) {
    const [lightbox, setLightbox] = useState(false);

    if (!url) return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-800/50 border border-white/[0.04]">
            <div className="w-7 h-7 rounded-lg bg-surface-700/60 flex items-center justify-center text-surface-600">
                {icon}
            </div>
            <span className="text-sm text-surface-500 flex-1">{label}</span>
            <span className="text-[10px] text-surface-600 italic">Not uploaded</span>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setLightbox(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-800/50 hover:bg-brand-500/10 border border-white/[0.04] hover:border-brand-500/25 transition-all group"
            >
                <div className="w-7 h-7 rounded-lg bg-surface-700/60 group-hover:bg-brand-500/20 flex items-center justify-center text-surface-400 group-hover:text-brand-400 transition-colors">
                    {icon}
                </div>
                <span className="text-sm text-surface-300 group-hover:text-white flex-1 text-left transition-colors">{label}</span>
                <span className="flex items-center gap-1 text-xs text-surface-500 group-hover:text-brand-400 transition-colors">
                    {Icons.eye} View
                </span>
            </button>
            {lightbox && <DocLightbox url={url} label={label} onClose={() => setLightbox(false)} />}
        </>
    );
}

// ─── KYC Field Row ────────────────────────────────────────────────────────────
function KycField({ label, value, masked }) {
    const [show, setShow] = useState(false);
    const display = masked && !show
        ? (value ? '•'.repeat(Math.min(8, value.length)) : '—')
        : (value || '—');

    return (
        <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
            <span className="text-xs text-surface-500 w-28 flex-shrink-0 font-medium">{label}</span>
            <span className="text-sm text-surface-200 flex-1 font-mono tracking-wide">{display}</span>
            {masked && value && (
                <button
                    onClick={() => setShow((s) => !s)}
                    className="flex-shrink-0 text-[10px] text-surface-500 hover:text-brand-400 transition-colors px-2 py-0.5 rounded-md border border-transparent hover:border-brand-500/20"
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            )}
        </div>
    );
}

// ─── Verification Card ────────────────────────────────────────────────────────
function VerificationCard({ v, onApprove, onReject, actionLoading }) {
    const [expanded, setExpanded] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const isBusy = actionLoading === v._id;

    const creator  = v.userId ?? {};
    const initials = (creator.name || creator.email || '?').charAt(0).toUpperCase();
    const status   = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.pending;

    return (
        <>
            <div className={`glass rounded-2xl border overflow-hidden transition-all duration-300 ${expanded ? 'border-brand-500/25 shadow-lg shadow-brand-500/5' : 'border-white/[0.06] hover:border-white/10'}`}>

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="px-4 sm:px-5 py-4">
                    <div className="flex items-start gap-3 sm:gap-4">

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-brand-500/20">
                                {initials}
                            </div>
                            {/* Status dot */}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-900 ${status.dot}`} />
                        </div>

                        {/* Creator info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <p className="font-bold text-white text-sm sm:text-base truncate">{creator.name || '—'}</p>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.cls}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                    {status.label}
                                </span>
                            </div>
                            <p className="text-xs text-surface-400 truncate">{creator.email || '—'}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                <span className="text-[11px] text-surface-600">
                                    Submitted {v.submittedAt ? formatDate(v.submittedAt) : formatDate(v.createdAt)}
                                </span>
                                {v.accountHolderName && (
                                    <span className="text-[11px] text-surface-600">
                                        · <span className="text-surface-400">{v.accountHolderName}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Toggle docs */}
                            <button
                                onClick={() => setExpanded((e) => !e)}
                                className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all ${expanded ? 'bg-brand-500/15 border-brand-500/35 text-brand-300' : 'glass border-white/10 text-surface-400 hover:text-white hover:border-brand-500/30'}`}
                            >
                                <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>{Icons.chevron}</span>
                                {expanded ? 'Collapse' : 'Details'}
                            </button>

                            {/* Status-specific actions */}
                            {v.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => onApprove(v._id)}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl font-semibold btn-brand disabled:opacity-50 transition-all"
                                    >
                                        {isBusy ? Icons.spinner : Icons.check}
                                        <span className="hidden sm:inline">Approve</span>
                                    </button>
                                    <button
                                        onClick={() => setRejectModal(true)}
                                        disabled={isBusy}
                                        className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-xl font-semibold border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 disabled:opacity-50 transition-all"
                                    >
                                        {Icons.x}
                                        <span className="hidden sm:inline">Reject</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mobile — expand toggle */}
                    <button
                        onClick={() => setExpanded((e) => !e)}
                        className={`sm:hidden mt-3 w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-all ${expanded ? 'bg-brand-500/15 border-brand-500/35 text-brand-300' : 'glass border-white/10 text-surface-400'}`}
                    >
                        <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>{Icons.chevron}</span>
                        {expanded ? 'Hide Details' : 'View Details'}
                    </button>
                </div>

                {/* ── Expanded Details ───────────────────────────────────── */}
                {expanded && (
                    <div className="border-t border-white/[0.06] bg-surface-900/30">
                        <div className="px-4 sm:px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-8">

                            {/* KYC Details */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center text-violet-400">{Icons.shield}</div>
                                    <p className="text-xs uppercase tracking-widest text-surface-500 font-bold">KYC Details</p>
                                </div>
                                <div className="glass rounded-xl border border-white/5 px-3 py-1 divide-y divide-white/[0.04]">
                                    <KycField label="Full Name"     value={v.accountHolderName || creator.name} />
                                    <KycField label="Aadhaar No."   value={v.aadhaarNumber} masked />
                                    <KycField label="PAN Number"    value={v.panNumber}     masked />
                                    <KycField label="Bank Account"  value={v.bankAccountNumber} masked />
                                    <KycField label="IFSC Code"     value={v.ifscCode} />
                                </div>

                                {/* Rejection reason */}
                                {v.rejectionReason && (
                                    <div className="mt-3 px-3 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
                                        <p className="text-[10px] uppercase tracking-wider text-red-500/70 font-bold mb-1">Rejection Reason</p>
                                        <p className="text-sm text-red-300">{v.rejectionReason}</p>
                                    </div>
                                )}

                                {/* Approval info */}
                                {v.status === 'approved' && v.approvedAt && (
                                    <div className="mt-3 px-3 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                        <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-bold mb-1">Approved</p>
                                        <p className="text-sm text-emerald-300">{formatDate(v.approvedAt)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Documents */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-md bg-sky-500/20 flex items-center justify-center text-sky-400">{Icons.doc}</div>
                                    <p className="text-xs uppercase tracking-widest text-surface-500 font-bold">Documents</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <DocButton label="Aadhaar Card" url={v.aadhaarImageUrl}  icon={Icons.user} />
                                    <DocButton label="PAN Card"     url={v.panImageUrl}      icon={Icons.shield} />
                                    <DocButton label="Bank Proof"   url={v.bankProofImageUrl} icon={Icons.bank} />
                                </div>

                                {/* Quick stats */}
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Aadhaar', ok: !!v.aadhaarImageUrl },
                                        { label: 'PAN',     ok: !!v.panImageUrl },
                                        { label: 'Bank',    ok: !!v.bankProofImageUrl },
                                    ].map(({ label, ok }) => (
                                        <div key={label} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold border ${ok ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-red-500/8 border-red-500/20 text-red-400'}`}>
                                            <span>{ok ? '✓' : '✗'}</span>
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {rejectModal && (
                <RejectModal
                    creatorName={creator.name}
                    onClose={() => setRejectModal(false)}
                    onConfirm={(reason) => { setRejectModal(false); onReject(v._id, reason); }}
                />
            )}
        </>
    );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="glass rounded-2xl border border-white/[0.06] p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="skeleton w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <div className="skeleton h-4 w-32" />
                        <div className="skeleton h-4 w-20 rounded-full" />
                    </div>
                    <div className="skeleton h-3 w-44 mb-1" />
                    <div className="skeleton h-3 w-28" />
                </div>
                <div className="hidden sm:flex gap-2">
                    <div className="skeleton h-8 w-20 rounded-xl" />
                    <div className="skeleton h-8 w-16 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

// ─── Main AdminVerifications ──────────────────────────────────────────────────
export default function AdminVerifications() {
    const [verifications, setVerifications] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [error, setError]                 = useState('');
    const [filter, setFilter]               = useState('pending');
    const [actionLoading, setActionLoading] = useState(null);
    const [counts, setCounts]               = useState({ pending: null, approved: null, rejected: null });

    const load = useCallback(async (status) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await adminService.getVerifications({ status, limit: 50 });
            setVerifications(data.results ?? []);
            setCounts((c) => ({ ...c, [status]: data.totalResults ?? (data.results?.length ?? 0) }));
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(filter); }, [filter, load]);

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            await adminService.approveVerification(id);
            setVerifications((v) => v.filter((r) => r._id !== id));
            setCounts((c) => ({ ...c, [filter]: Math.max(0, (c[filter] ?? 1) - 1) }));
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (id, reason) => {
        setActionLoading(id);
        try {
            await adminService.rejectVerification(id, reason);
            setVerifications((v) => v.filter((r) => r._id !== id));
            setCounts((c) => ({ ...c, [filter]: Math.max(0, (c[filter] ?? 1) - 1) }));
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setActionLoading(null); }
    };

    const currentCount = counts[filter];

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="mb-7">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-violet-600/20 border border-brand-500/25 flex items-center justify-center text-lg flex-shrink-0">
                        🪪
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Verifications</h1>
                </div>
                <p className="text-surface-400 text-sm mt-0.5 ml-[52px]">
                    Review creator KYC documents and manage verification status.
                </p>
            </div>

            {/* ── Status Tabs ──────────────────────────────────────────── */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hidden">
                {TABS.map(({ key, label, color, bg }) => {
                    const isActive = filter === key;
                    const count = counts[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-all duration-200 ${isActive ? `${bg} ${color}` : 'glass border-white/8 text-surface-400 hover:text-surface-200 hover:border-white/15'}`}
                        >
                            {label}
                            {count !== null && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/10' : 'bg-surface-700 text-surface-500'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}

                {/* Refresh button */}
                <button
                    onClick={() => load(filter)}
                    disabled={loading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-surface-400 hover:text-white border border-white/8 hover:border-white/15 glass transition-all disabled:opacity-40"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    Refresh
                </button>
            </div>

            {/* ── Error Banner ─────────────────────────────────────────── */}
            {error && (
                <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-xs flex-shrink-0">!</span>
                    {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-500/60 hover:text-red-400">{Icons.close}</button>
                </div>
            )}

            {/* ── Result count ─────────────────────────────────────────── */}
            {!loading && verifications.length > 0 && (
                <p className="text-xs text-surface-600 mb-3">
                    Showing {verifications.length}{currentCount !== null && currentCount > verifications.length ? ` of ${currentCount}` : ''} {filter} application{verifications.length !== 1 ? 's' : ''}
                </p>
            )}

            {/* ── List ─────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : verifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-surface-500">
                    {Icons.empty}
                    <p className="mt-4 text-sm font-medium">No {filter} verifications</p>
                    <p className="text-xs text-surface-600 mt-1">
                        {filter === 'pending' ? 'All caught up — no applications waiting for review.' : `No ${filter} applications to display.`}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {verifications.map((v) => (
                        <VerificationCard
                            key={v._id}
                            v={v}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            actionLoading={actionLoading}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
