import { useState, useEffect, useCallback } from 'react';
import dreamFundService from '../../services/dreamFundService';

const STATUS_COLORS = {
    pending: '#f59e0b',
    approved: '#22c55e',
    rejected: '#f87171',
    completed: '#a855f7',
    awaiting_verification: '#60a5fa',
    verified: '#4ade80',
};

const STATUS_LABELS = {
    all: 'All',
    pending: 'Pending',
    approved: 'Active',
    rejected: 'Rejected',
    completed: 'Goal Reached',
    awaiting_verification: 'Awaiting Proof',
    verified: 'Verified',
};

export default function AdminDreamFunds() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending');
    const [actionGoal, setActionGoal] = useState(null);
    const [actionType, setActionType] = useState(''); // 'approve'|'reject'|'verify'|'reject-proof'
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const loadGoals = useCallback(() => {
        setLoading(true);
        const statusParam = filter === 'all' ? undefined : filter;
        dreamFundService.adminListDreamFunds(statusParam)
            .then(r => setGoals(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [filter]);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const handleAction = async () => {
        if (!actionGoal) return;
        setSubmitting(true);
        try {
            if (actionType === 'approve') {
                await dreamFundService.adminApproveGoal(actionGoal._id);
                showToast('✅ Goal approved!');
            } else if (actionType === 'reject') {
                await dreamFundService.adminRejectGoal(actionGoal._id, reason);
                showToast('❌ Goal rejected');
            } else if (actionType === 'verify') {
                await dreamFundService.adminVerifyProof(actionGoal._id);
                showToast('✅ Proof verified!');
            } else if (actionType === 'reject-proof') {
                await dreamFundService.adminRejectProof(actionGoal._id, reason);
                showToast('⚠️ Proof rejected — creator notified to re-upload');
            }
            setActionGoal(null);
            setReason('');
            loadGoals();
        } catch (e) {
            showToast('❌ Action failed: ' + (e?.response?.data?.message || e.message));
        } finally {
            setSubmitting(false);
        }
    };

    const cardBg = 'rgba(255,255,255,0.03)';
    const cardBorder = '1px solid rgba(255,255,255,0.08)';

    return (
        <div style={{ minHeight: '100vh', background: '#050208', padding: '24px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 26, margin: 0, letterSpacing: '-0.04em' }}>
                        🌟 Dream Fund Management
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '6px 0 0' }}>
                        Approve, reject, and verify creator funding goals
                    </p>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        position: 'fixed', top: 20, right: 20, zIndex: 9999,
                        background: 'linear-gradient(135deg, #1a0b2e, #0d0718)',
                        border: '1px solid rgba(168,85,247,0.4)', borderRadius: 14,
                        padding: '12px 20px', color: '#fff', fontWeight: 700, fontSize: 13,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}>
                        {toast}
                    </div>
                )}

                {/* Status filter tabs */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            style={{
                                padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                background: filter === key ? 'linear-gradient(135deg, #9333ea, #ec4899)' : cardBg,
                                border: filter === key ? '1px solid transparent' : cardBorder,
                                color: filter === key ? '#fff' : 'rgba(255,255,255,0.55)',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Goals list */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
                ) : goals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                        <div style={{ fontSize: 44, marginBottom: 12 }}>🌟</div>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>No goals found for this filter</p>
                    </div>
                ) : (
                    goals.map(goal => {
                        const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
                        const statusColor = STATUS_COLORS[goal.status] || '#fff';
                        const creator = goal.creatorId;

                        return (
                            <div key={goal._id} style={{
                                background: cardBg, border: cardBorder, borderRadius: 20,
                                padding: 20, marginBottom: 16,
                                transition: 'border-color 0.2s ease',
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            >
                                {/* Goal header */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                                    {goal.image && (
                                        <img
                                            src={goal.image} alt={goal.title}
                                            style={{ width: 70, height: 70, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                                        />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                                            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: 0 }}>{goal.title}</h3>
                                            <span style={{
                                                color: statusColor, fontSize: 11, fontWeight: 700,
                                                background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
                                                padding: '3px 10px', borderRadius: 999,
                                            }}>
                                                {STATUS_LABELS[goal.status] || goal.status}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                                                👤 <strong style={{ color: '#fff' }}>{creator?.name || 'Creator'}</strong>
                                                {creator?.username && <span style={{ color: 'rgba(255,255,255,0.4)' }}> @{creator.username}</span>}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                                                Target: <strong style={{ color: '#fff' }}>₹{goal.targetAmount.toLocaleString('en-IN')}</strong>
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                                                Raised: <strong style={{ color: '#22c55e' }}>₹{goal.currentAmount.toLocaleString('en-IN')}</strong>
                                            </span>
                                        </div>

                                        {goal.description && (
                                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                                                {goal.description.slice(0, 180)}{goal.description.length > 180 ? '…' : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                                        <span>{pct}% funded</span>
                                        <span>₹{Math.max(0, goal.targetAmount - goal.currentAmount).toLocaleString('en-IN')} remaining</span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
                                        <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #9333ea, #ec4899)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>

                                {/* Proof section */}
                                {goal.status === 'awaiting_verification' && goal.proof?.url && (
                                    <div style={{ marginBottom: 14, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 12, padding: 12 }}>
                                        <p style={{ color: '#60a5fa', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>📎 Uploaded Proof</p>
                                        {goal.proof.type === 'video' ? (
                                            <video
                                                src={goal.proof.url}
                                                controls
                                                style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10 }}
                                            />
                                        ) : (
                                            <img
                                                src={goal.proof.url}
                                                alt="Proof"
                                                style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10, objectFit: 'cover' }}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Rejection reason */}
                                {goal.rejectionReason && (
                                    <div style={{ marginBottom: 14, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '8px 12px' }}>
                                        <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>Rejection reason: {goal.rejectionReason}</p>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {goal.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => { setActionGoal(goal); setActionType('approve'); }}
                                                style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                            >
                                                ✅ Approve
                                            </button>
                                            <button
                                                onClick={() => { setActionGoal(goal); setActionType('reject'); }}
                                                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                            >
                                                ❌ Reject
                                            </button>
                                        </>
                                    )}
                                    {goal.status === 'awaiting_verification' && (
                                        <>
                                            <button
                                                onClick={() => { setActionGoal(goal); setActionType('verify'); }}
                                                style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #9333ea, #a855f7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                            >
                                                ✅ Verify Proof
                                            </button>
                                            <button
                                                onClick={() => { setActionGoal(goal); setActionType('reject-proof'); }}
                                                style={{ padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                            >
                                                ⚠️ Reject Proof
                                            </button>
                                        </>
                                    )}
                                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, alignSelf: 'center' }}>
                                        Created {new Date(goal.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Confirmation dialog */}
            {actionGoal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setActionGoal(null); setReason(''); } }}
                >
                    <div style={{
                        background: 'linear-gradient(145deg, #1a0b2e, #0d0718)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 24, padding: 28, maxWidth: 440, width: '100%',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
                    }}>
                        <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                            {actionType === 'approve' && '✅ Approve Dream Fund?'}
                            {actionType === 'reject' && '❌ Reject Dream Fund'}
                            {actionType === 'verify' && '✅ Verify Proof?'}
                            {actionType === 'reject-proof' && '⚠️ Reject Proof'}
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 16 }}>
                            <strong style={{ color: '#fff' }}>{actionGoal.title}</strong>
                            {' '}by <strong style={{ color: '#fff' }}>{actionGoal.creatorId?.name}</strong>
                        </p>

                        {(actionType === 'reject' || actionType === 'reject-proof') && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                    Reason {actionType === 'reject' ? '(sent to creator)' : '(re-upload request)'}
                                </p>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Explain the reason..."
                                    rows={3}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13, resize: 'vertical',
                                        background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
                                        color: '#fff', outline: 'none', boxSizing: 'border-box',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={handleAction}
                                disabled={submitting}
                                style={{
                                    flex: 1, height: 46, borderRadius: 14, border: 'none',
                                    background: (actionType === 'reject' || actionType === 'reject-proof')
                                        ? 'linear-gradient(135deg, #f87171, #ef4444)'
                                        : 'linear-gradient(135deg, #9333ea, #a855f7)',
                                    color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                }}
                            >
                                {submitting ? 'Processing…' : 'Confirm'}
                            </button>
                            <button
                                onClick={() => { setActionGoal(null); setReason(''); }}
                                style={{ flex: 1, height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
