import { useState, useEffect, useCallback } from 'react';
import dreamFundService from '../../services/dreamFundService';

// ── Image URL helper ─────────────────────────────────────────────────────────
// Many images are stored as relative paths on the API server. This helper
// converts them to full absolute URLs so they load correctly from any domain.
const API_BASE = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'https://api.fannex.in';

function getImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url}`;
}

const STATUS_META = {
    pending:              { label: 'Pending',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
    approved:             { label: 'Active',          color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)'   },
    rejected:             { label: 'Rejected',        color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
    completed:            { label: 'Goal Reached',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.25)'  },
    awaiting_verification:{ label: 'Awaiting Proof',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
    verified:             { label: 'Verified ✓',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)'  },
};

const FILTERS = [
    { key: 'all',                  label: 'All' },
    { key: 'pending',              label: 'Pending' },
    { key: 'approved',             label: 'Active' },
    { key: 'rejected',             label: 'Rejected' },
    { key: 'completed',            label: 'Goal Reached' },
    { key: 'awaiting_verification',label: 'Awaiting Proof' },
    { key: 'verified',             label: 'Verified' },
];

// ── Goal Card ──────────────────────────────────────────────────────────────────
function GoalCard({ goal, onAction }) {
    const [imgError, setImgError] = useState(false);
    const [proofError, setProofError] = useState(false);

    const pct = goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
        : 0;
    const meta = STATUS_META[goal.status] || { label: goal.status, color: '#fff', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)' };
    const creator = goal.creatorId;
    const imageUrl = !imgError ? getImageUrl(goal.image) : null;
    const proofUrl = !proofError ? getImageUrl(goal.proof?.url) : null;

    return (
        <div style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            transition: 'all 0.25s ease',
        }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            {/* Goal Banner Image */}
            {imageUrl && (
                <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                    <img
                        src={imageUrl}
                        alt={goal.title}
                        onError={() => setImgError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(5,2,8,0.95) 0%, rgba(5,2,8,0.3) 50%, transparent 100%)',
                    }} />
                    {/* Status badge overlay */}
                    <span style={{
                        position: 'absolute', top: 12, right: 12,
                        background: meta.bg, border: `1px solid ${meta.border}`,
                        color: meta.color, fontWeight: 800, fontSize: 11,
                        padding: '4px 12px', borderRadius: 999, backdropFilter: 'blur(8px)',
                        letterSpacing: '0.02em',
                    }}>
                        {meta.label}
                    </span>
                </div>
            )}

            <div style={{ padding: '20px 20px 16px' }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 17, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.3, flex: 1 }}>
                        {goal.title}
                    </h3>
                    {!imageUrl && (
                        <span style={{
                            background: meta.bg, border: `1px solid ${meta.border}`,
                            color: meta.color, fontWeight: 800, fontSize: 11,
                            padding: '4px 12px', borderRadius: 999, flexShrink: 0,
                        }}>
                            {meta.label}
                        </span>
                    )}
                </div>

                {/* Creator info row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>👤</span>
                        <strong style={{ color: '#e2e2e2' }}>{creator?.name || 'Creator'}</strong>
                        {creator?.username && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>@{creator.username}</span>}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        Target: <strong style={{ color: '#fff' }}>₹{goal.targetAmount.toLocaleString('en-IN')}</strong>
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        Raised: <strong style={{ color: '#22c55e' }}>₹{goal.currentAmount.toLocaleString('en-IN')}</strong>
                    </span>
                </div>

                {goal.description && (
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
                        {goal.description.slice(0, 200)}{goal.description.length > 200 ? '…' : ''}
                    </p>
                )}

                {/* Progress */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>
                        <span>{pct}% funded</span>
                        <span>₹{Math.max(0, goal.targetAmount - goal.currentAmount).toLocaleString('en-IN')} remaining</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 999,
                            background: pct >= 100
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : 'linear-gradient(90deg, #9333ea, #ec4899)',
                            width: `${pct}%`,
                            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                            boxShadow: pct >= 100 ? '0 0 12px rgba(34,197,94,0.5)' : '0 0 10px rgba(168,85,247,0.4)',
                        }} />
                    </div>
                </div>

                {/* Proof section (awaiting_verification) */}
                {goal.status === 'awaiting_verification' && goal.proof?.url && (
                    <div style={{
                        marginBottom: 14,
                        background: 'rgba(96,165,250,0.06)',
                        border: '1px solid rgba(96,165,250,0.2)',
                        borderRadius: 14,
                        padding: 14,
                    }}>
                        <p style={{ color: '#60a5fa', fontWeight: 700, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            📎 Proof Uploaded — Review Required
                        </p>
                        {proofUrl && (
                            goal.proof.type === 'video' ? (
                                <video
                                    src={proofUrl}
                                    controls
                                    onError={() => setProofError(true)}
                                    style={{ width: '100%', maxHeight: 280, borderRadius: 10, display: 'block' }}
                                />
                            ) : (
                                <img
                                    src={proofUrl}
                                    alt="Proof"
                                    onError={() => setProofError(true)}
                                    style={{ width: '100%', maxHeight: 280, borderRadius: 10, objectFit: 'cover', display: 'block' }}
                                />
                            )
                        )}
                        {!proofUrl && (
                            <p style={{ color: 'rgba(96,165,250,0.6)', fontSize: 12, margin: 0 }}>
                                ⚠️ Proof file unavailable — click Verify/Reject to action anyway
                            </p>
                        )}
                    </div>
                )}

                {/* Rejection reason */}
                {goal.rejectionReason && (
                    <div style={{
                        marginBottom: 14,
                        background: 'rgba(248,113,113,0.06)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        borderRadius: 10, padding: '8px 12px',
                    }}>
                        <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>
                            ❌ Rejection reason: {goal.rejectionReason}
                        </p>
                    </div>
                )}

                {/* Action buttons + date */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {goal.status === 'pending' && (
                        <>
                            <button
                                onClick={() => onAction(goal, 'approve')}
                                style={{
                                    padding: '9px 20px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,197,94,0.35)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                ✅ Approve
                            </button>
                            <button
                                onClick={() => onAction(goal, 'reject')}
                                style={{
                                    padding: '9px 20px', borderRadius: 12,
                                    border: '1px solid rgba(248,113,113,0.35)',
                                    background: 'rgba(248,113,113,0.08)',
                                    color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                            >
                                ❌ Reject
                            </button>
                        </>
                    )}
                    {goal.status === 'awaiting_verification' && (
                        <>
                            <button
                                onClick={() => onAction(goal, 'verify')}
                                style={{
                                    padding: '9px 20px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #9333ea, #a855f7)',
                                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(168,85,247,0.35)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                ✅ Verify Proof
                            </button>
                            <button
                                onClick={() => onAction(goal, 'reject-proof')}
                                style={{
                                    padding: '9px 20px', borderRadius: 12,
                                    border: '1px solid rgba(248,113,113,0.35)',
                                    background: 'rgba(248,113,113,0.08)',
                                    color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                            >
                                ⚠️ Reject Proof
                            </button>
                        </>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginLeft: 'auto' }}>
                        {new Date(goal.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ goal, actionType, onConfirm, onCancel, submitting }) {
    const [reason, setReason] = useState('');
    const needsReason = actionType === 'reject' || actionType === 'reject-proof';
    const isDestructive = needsReason;

    const titles = {
        approve: '✅ Approve Dream Fund?',
        reject: '❌ Reject Dream Fund',
        verify: '✅ Verify Proof?',
        'reject-proof': '⚠️ Reject Proof & Request Re-upload',
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div style={{
                background: 'linear-gradient(145deg, #1a0b2e 0%, #0d0718 100%)',
                border: `1px solid ${isDestructive ? 'rgba(248,113,113,0.25)' : 'rgba(168,85,247,0.25)'}`,
                borderRadius: 24, padding: '28px 24px',
                maxWidth: 460, width: '100%',
                boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
                animation: 'fadeUp 0.2s ease',
            }}>
                <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }`}</style>

                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 19, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                    {titles[actionType]}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
                    <strong style={{ color: '#e2e2e2' }}>{goal.title}</strong> by{' '}
                    <strong style={{ color: '#e2e2e2' }}>{goal.creatorId?.name}</strong>
                </p>

                {needsReason && (
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                            Reason {actionType === 'reject' ? '(sent to creator)' : '(re-upload request)'}
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain the reason…"
                            rows={3}
                            autoFocus
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: 14, fontSize: 14, resize: 'vertical',
                                background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.10)',
                                color: '#fff', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={(e) => { e.target.style.borderColor = 'rgba(168,85,247,0.55)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={submitting}
                        style={{
                            flex: 1, height: 48, borderRadius: 14, border: 'none',
                            background: isDestructive
                                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                : 'linear-gradient(135deg, #9333ea, #a855f7)',
                            color: '#fff', fontWeight: 800, fontSize: 15,
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {submitting ? 'Processing…' : 'Confirm'}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        style={{
                            flex: 1, height: 48, borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminDreamFunds() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [actionGoal, setActionGoal] = useState(null);
    const [actionType, setActionType] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ msg: '', ok: true });

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast({ msg: '', ok: true }), 3500);
    };

    const loadGoals = useCallback(() => {
        setLoading(true);
        const statusParam = filter === 'all' ? undefined : filter;
        dreamFundService.adminListDreamFunds(statusParam)
            .then((r) => setGoals(r.data.data || []))
            .catch(() => showToast('Failed to load goals', false))
            .finally(() => setLoading(false));
    }, [filter]);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const handleConfirm = async (reason) => {
        if (!actionGoal) return;
        setSubmitting(true);
        try {
            if (actionType === 'approve')       await dreamFundService.adminApproveGoal(actionGoal._id);
            else if (actionType === 'reject')   await dreamFundService.adminRejectGoal(actionGoal._id, reason);
            else if (actionType === 'verify')   await dreamFundService.adminVerifyProof(actionGoal._id);
            else if (actionType === 'reject-proof') await dreamFundService.adminRejectProof(actionGoal._id, reason);

            showToast(
                actionType === 'approve' ? '✅ Goal approved and now live!'
                : actionType === 'reject' ? '❌ Goal rejected, creator notified'
                : actionType === 'verify' ? '✅ Proof verified!'
                : '⚠️ Proof rejected — creator notified to re-upload'
            );
            setActionGoal(null);
            loadGoals();
        } catch (e) {
            showToast('❌ ' + (e?.response?.data?.message || e.message), false);
        } finally {
            setSubmitting(false);
        }
    };

    // Stats for header
    const totalPending  = goals.filter(g => g.status === 'pending').length;
    const totalActive   = goals.filter(g => g.status === 'approved').length;
    const totalProof    = goals.filter(g => g.status === 'awaiting_verification').length;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120,40,200,0.12), transparent), #050208',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>
            <div style={{ maxWidth: 940, margin: '0 auto', padding: '28px 16px 48px' }}>

                {/* ── Toast ──────────────────────────────────────────────────── */}
                {toast.msg && (
                    <div style={{
                        position: 'fixed', top: 20, right: 20, zIndex: 99999,
                        background: toast.ok
                            ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(26,11,46,0.95))'
                            : 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(26,11,46,0.95))',
                        border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)'}`,
                        borderRadius: 14, padding: '14px 20px',
                        color: toast.ok ? '#4ade80' : '#f87171',
                        fontWeight: 700, fontSize: 13,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(12px)',
                        animation: 'slideIn 0.3s ease',
                        maxWidth: 320,
                    }}>
                        <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }`}</style>
                        {toast.msg}
                    </div>
                )}

                {/* ── Page Header ────────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{
                        color: '#fff', fontWeight: 900, fontSize: 'clamp(22px, 5vw, 30px)',
                        margin: 0, letterSpacing: '-0.04em', lineHeight: 1.1,
                    }}>
                        🌟 Dream Fund Management
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, margin: '7px 0 0' }}>
                        Approve, verify and manage creator funding goals
                    </p>
                </div>

                {/* ── Stats Strip ────────────────────────────────────────────── */}
                {!loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Pending Review', value: totalPending,  color: '#f59e0b', icon: '⏳' },
                            { label: 'Active Goals',   value: totalActive,   color: '#22c55e', icon: '✅' },
                            { label: 'Needs Verify',   value: totalProof,    color: '#60a5fa', icon: '📎' },
                        ].map((s) => (
                            <div key={s.label} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 16, padding: '14px 16px',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                                <div style={{ color: s.color, fontWeight: 900, fontSize: 24 }}>{s.value}</div>
                                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filter Tabs ────────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {FILTERS.map(({ key, label }) => {
                        const active = filter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                style={{
                                    padding: '8px 18px', borderRadius: 999,
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    background: active ? 'linear-gradient(135deg, #9333ea, #ec4899)' : 'rgba(255,255,255,0.04)',
                                    border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)',
                                    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                                    transition: 'all 0.15s ease',
                                    boxShadow: active ? '0 4px 16px rgba(147,51,234,0.3)' : 'none',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Content ────────────────────────────────────────────────── */}
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[1, 2, 3].map((i) => (
                            <div key={i} style={{
                                height: 220, borderRadius: 20,
                                background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 1.8s infinite',
                            }} />
                        ))}
                        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
                    </div>
                ) : goals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 20px' }}>
                        <div style={{ fontSize: 52, marginBottom: 16 }}>🌟</div>
                        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>
                            No goals found
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
                            There are no Dream Fund goals matching this filter.
                        </p>
                    </div>
                ) : (
                    goals.map((goal) => (
                        <GoalCard
                            key={goal._id}
                            goal={goal}
                            onAction={(g, type) => { setActionGoal(g); setActionType(type); }}
                        />
                    ))
                )}
            </div>

            {/* ── Confirm Dialog ─────────────────────────────────────────────── */}
            {actionGoal && (
                <ConfirmDialog
                    goal={actionGoal}
                    actionType={actionType}
                    submitting={submitting}
                    onConfirm={handleConfirm}
                    onCancel={() => { setActionGoal(null); }}
                />
            )}
        </div>
    );
}
