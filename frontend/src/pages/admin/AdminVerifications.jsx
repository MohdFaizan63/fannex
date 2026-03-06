import { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/adminService';
import { formatDate, getErrorMessage } from '../../utils/helpers';

// ── Lightbox for document images ──────────────────────────────────────────────
function DocLightbox({ url, label, onClose }) {
    const ref = useRef();
    useEffect(() => {
        const handler = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            onClick={(e) => e.target === ref.current && onClose()}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        >
            <div className="max-w-2xl w-full animate-fade-in-up">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <button onClick={onClose}
                        className="text-surface-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {url.endsWith('.pdf') || url.includes('pdf') ? (
                    <iframe src={url} className="w-full h-[70vh] rounded-xl" title={label} />
                ) : (
                    <img src={url} alt={label}
                        className="w-full max-h-[70vh] object-contain rounded-xl" />
                )}
                <a href={url} target="_blank" rel="noopener noreferrer"
                    className="block text-center text-xs text-brand-400 hover:text-brand-300 mt-3">
                    Open in new tab ↗
                </a>
            </div>
        </div>
    );
}

// ── Reject reason modal ───────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="glass rounded-2xl p-6 w-full max-w-sm border border-white/10 animate-fade-in-up">
                <h3 className="text-lg font-bold text-white mb-4">Reject Verification</h3>
                <textarea
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(''); }}
                    placeholder="Provide a clear rejection reason for the creator…"
                    rows={4}
                    className="input-dark w-full resize-none"
                />
                {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="btn-outline flex-1 py-2.5">Cancel</button>
                    <button
                        onClick={() => {
                            if (!reason.trim()) { setError('Please provide a rejection reason.'); return; }
                            onConfirm(reason.trim());
                        }}
                        className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
                    >
                        Confirm Reject
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Document row (image/pdf with lightbox toggle) ─────────────────────────────
function DocRow({ label, url }) {
    const [lightbox, setLightbox] = useState(false);
    if (!url) return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="text-xs text-surface-600 w-32 font-medium">{label}</span>
            <span className="text-xs text-surface-600 italic">Not uploaded</span>
        </div>
    );
    return (
        <>
            <div className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-surface-400 w-32 font-medium">{label}</span>
                <button onClick={() => setLightbox(true)}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-700/60 hover:bg-brand-500/20 hover:text-brand-400 text-xs text-surface-300 transition-all border border-white/5 hover:border-brand-500/30">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                </button>
            </div>
            {lightbox && <DocLightbox url={url} label={label} onClose={() => setLightbox(false)} />}
        </>
    );
}

// ── Verification card ─────────────────────────────────────────────────────────
function VerificationCard({ v, onApprove, onReject, actionLoading }) {
    const [expanded, setExpanded] = useState(false);
    const [rejectModal, setRejectModal] = useState(false);
    const isBusy = actionLoading === v._id;

    const creator = v.userId ?? {};
    const docs = v.documents ?? v; // handle both schemas

    return (
        <>
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {/* Header row */}
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-600
            flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {creator.name?.charAt(0)?.toUpperCase() ?? 'C'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{creator.name ?? '—'}</p>
                        <p className="text-xs text-surface-400 truncate">{creator.email ?? '—'}</p>
                        <p className="text-xs text-surface-600 mt-0.5">
                            Submitted {v.submittedAt ? formatDate(v.submittedAt) : formatDate(v.createdAt)}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setExpanded((e) => !e)}
                            className="text-xs px-3 py-1.5 rounded-lg glass border border-white/10 text-surface-300 hover:text-white hover:border-brand-500/40 transition-all">
                            {expanded ? 'Hide docs' : 'View docs'}
                        </button>
                        <button onClick={() => onApprove(v._id)} disabled={isBusy}
                            className="btn-brand text-xs px-4 py-1.5 disabled:opacity-50">
                            {isBusy ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => setRejectModal(true)} disabled={isBusy}
                            className="text-xs px-4 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                            Reject
                        </button>
                    </div>
                </div>

                {/* Expanded: KYC detail + documents ──── */}
                {expanded && (
                    <div className="border-t border-white/5 px-5 py-5 grid sm:grid-cols-2 gap-6">
                        {/* Personal / bank info */}
                        <div>
                            <p className="text-xs uppercase tracking-widest text-surface-600 font-semibold mb-3">KYC Details</p>
                            {[
                                { label: 'Full Name', value: v.fullName },
                                { label: 'Date of Birth', value: v.dateOfBirth ? new Date(v.dateOfBirth).toLocaleDateString('en-IN') : undefined },
                                { label: 'Aadhaar Number', value: v.aadhaarNumber },
                                { label: 'PAN', value: v.pan },
                                { label: 'Bank Account', value: v.bankAccount },
                                { label: 'IFSC Code', value: v.ifsc },
                                { label: 'Address', value: v.address ? `${v.address.street}, ${v.address.city}, ${v.address.state} ${v.address.postalCode}` : undefined },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex gap-3 mb-1.5">
                                    <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                                    <span className="text-xs text-surface-200">{value ?? '—'}</span>
                                </div>
                            ))}
                        </div>

                        {/* Documents */}
                        <div>
                            <p className="text-xs uppercase tracking-widest text-surface-600 font-semibold mb-3">Documents</p>
                            <DocRow label="Aadhaar Card" url={docs.aadhaarImage ?? docs.govIdFront} />
                            <DocRow label="PAN Card" url={docs.panImage ?? docs.govIdBack} />
                            <DocRow label="Bank Proof" url={docs.bankProof ?? docs.selfie} />
                        </div>
                    </div>
                )}
            </div>

            {/* Reject reason modal */}
            {rejectModal && (
                <RejectModal
                    onClose={() => setRejectModal(false)}
                    onConfirm={(reason) => { setRejectModal(false); onReject(v._id, reason); }}
                />
            )}
        </>
    );
}

// ── Main AdminVerifications ───────────────────────────────────────────────────
export default function AdminVerifications() {
    const [verifications, setVerifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('pending');
    const [actionLoading, setActionLoading] = useState(null);
    const [totalResults, setTotal] = useState(0);

    const load = async (status) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await adminService.getVerifications({ status, limit: 50 });
            setVerifications(data.results ?? []);
            setTotal(data.totalResults ?? 0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(filter); }, [filter]);

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            await adminService.approveVerification(id);
            setVerifications((v) => v.filter((r) => r._id !== id));
            setTotal((t) => t - 1);
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (id, reason) => {
        setActionLoading(id);
        try {
            await adminService.rejectVerification(id, reason);
            setVerifications((v) => v.filter((r) => r._id !== id));
            setTotal((t) => t - 1);
        } catch (err) { setError(getErrorMessage(err)); }
        finally { setActionLoading(null); }
    };

    const TABS = ['pending', 'approved', 'rejected'];

    return (
        <div className="p-6 max-w-5xl">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">🪪 Verifications</h1>
                <p className="text-surface-400 mt-1">
                    Review creator KYC documents and manage verification status.
                </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-7">
                {TABS.map((s) => (
                    <button key={s} onClick={() => setFilter(s)}
                        className={`px-5 py-2 rounded-full text-sm font-medium capitalize transition-all ${filter === s ? 'btn-brand' : 'glass border border-white/10 text-surface-300 hover:text-white hover:border-brand-500/30'
                            }`}>
                        {s}
                        {filter === s && !loading && (
                            <span className="ml-2 text-xs opacity-70">({totalResults})</span>
                        )}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex flex-col gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="glass rounded-2xl border border-white/5 p-5">
                            <div className="flex gap-3 items-center">
                                <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="skeleton h-4 w-32 mb-1.5" />
                                    <div className="skeleton h-3 w-48" />
                                </div>
                                <div className="skeleton h-8 w-24 rounded-xl" />
                                <div className="skeleton h-8 w-20 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : verifications.length === 0 ? (
                <div className="text-center py-16 text-surface-500">
                    <div className="text-4xl mb-3">📭</div>
                    <p>No {filter} verifications.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
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
