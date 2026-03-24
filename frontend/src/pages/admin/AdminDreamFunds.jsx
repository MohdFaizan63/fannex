import { useState, useEffect, useCallback, useRef } from 'react';
import dreamFundService from '../../services/dreamFundService';

// ── Image URL helper ──────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'https://api.fannex.in';

function getImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
}

const fmt = (n) => (n || 0).toLocaleString('en-IN');
const R   = (n) => Math.round((n || 0) * 100) / 100;

// ── Config ────────────────────────────────────────────────────────────────────
const CREATOR_SHARE = 0.80;

const STATUS_META = {
    pending:               { label: 'Pending',       emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.28)'  },
    approved:              { label: 'Active',         emoji: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.28)'   },
    rejected:              { label: 'Rejected',       emoji: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.28)' },
    completed:             { label: 'Goal Reached',   emoji: '🎯', color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.28)'  },
    awaiting_verification: { label: 'Awaiting Proof', emoji: '📎', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.28)'  },
    verified:              { label: 'Verified',       emoji: '✓',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.28)'  },
    paid:                  { label: 'Paid ✓',         emoji: '💸', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.28)'  },
};

// Primary tabs shown to admin — clean 4-section layout as requested
const TABS = [
    { key: 'pending',   label: 'Pending',    emoji: '⏳', statusKeys: ['pending']                                              },
    { key: 'active',    label: 'Active',     emoji: '🟢', statusKeys: ['approved']                                             },
    { key: 'completed', label: 'Completed',  emoji: '🏆', statusKeys: ['completed', 'awaiting_verification', 'verified']       },
    { key: 'rejected',  label: 'Rejected',   emoji: '❌', statusKeys: ['rejected']                                             },
    { key: 'paid',      label: 'Paid',       emoji: '💸', statusKeys: ['paid']                                                 },
];

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => (
                <div key={i} style={{ height: 200, borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.03)' }} />
                    <div className="admin-df-shimmer" style={{ position: 'absolute', inset: 0 }} />
                </div>
            ))}
        </div>
    );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, onAction }) {
    const [imgError, setImgError] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const pct    = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
    const meta   = STATUS_META[goal.status] || STATUS_META.pending;
    const creator = goal.creatorId || {};
    const imageUrl = !imgError ? getImageUrl(goal.image) : null;
    const creatorShare = R(goal.currentAmount * CREATOR_SHARE);
    const isPayable = ['completed', 'awaiting_verification', 'verified'].includes(goal.status);

    return (
        <div style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)',
            border: `1px solid ${isPayable ? 'rgba(168,85,247,0.3)' : meta.border}`,
            borderRadius: 20, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            {/* Banner image */}
            {imageUrl && (
                <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
                    <img src={imageUrl} alt={goal.title} onError={() => setImgError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(5,2,10,0.95), transparent 55%)' }} />
                    <span style={{ position: 'absolute', top: 10, right: 10, background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(8px)' }}>
                        {meta.emoji} {meta.label}
                    </span>
                </div>
            )}

            <div style={{ padding: '18px 18px 14px' }}>
                {/* Title + status (no image case) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {!imageUrl && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, marginBottom: 6 }}>
                                {meta.emoji} {meta.label}
                            </span>
                        )}
                        <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            {goal.title}
                        </h3>
                    </div>
                </div>

                {/* Creator info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#9333ea,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        {(creator.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: '#e2e2e2', fontWeight: 700, fontSize: 13, margin: 0, truncate: true }}>{creator.name || 'Creator'}</p>
                        {creator.email && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{creator.email}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Target: <strong style={{ color: '#fff' }}>₹{fmt(goal.targetAmount)}</strong></span>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Raised: <strong style={{ color: '#4ade80' }}>₹{fmt(R(goal.currentAmount))}</strong></span>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                        <span>{pct}% funded</span>
                        <span>₹{fmt(Math.max(0, goal.targetAmount - goal.currentAmount))} remaining</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, transition: 'width 0.6s ease', background: pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#9333ea,#ec4899)', boxShadow: pct >= 100 ? '0 0 10px rgba(34,197,94,0.4)' : '0 0 8px rgba(168,85,247,0.35)' }} />
                    </div>
                </div>

                {/* Creator 80% share display */}
                {goal.currentAmount > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator Earns (80%)</p>
                            <p style={{ color: '#4ade80', fontWeight: 800, fontSize: 14, margin: 0 }}>₹{fmt(creatorShare)}</p>
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)' }}>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform (20%)</p>
                            <p style={{ color: '#a855f7', fontWeight: 800, fontSize: 14, margin: 0 }}>₹{fmt(R(goal.currentAmount * 0.20))}</p>
                        </div>
                    </div>
                )}

                {/* Paid info */}
                {goal.status === 'paid' && goal.paidAt && (
                    <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: 12 }}>
                        <p style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, margin: 0 }}>
                            💸 Paid on {new Date(goal.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                )}

                {/* Rejection reason */}
                {goal.rejectionReason && (
                    <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 12 }}>
                        <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>❌ Reason: {goal.rejectionReason}</p>
                    </div>
                )}

                {/* Description toggle */}
                {goal.description && (
                    <div style={{ marginBottom: 12 }}>
                        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                            {expanded ? '▲ Hide description' : '▼ Show description'}
                        </button>
                        {expanded && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{goal.description}</p>}
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {goal.status === 'pending' && (
                        <>
                            <ActionBtn color="green" onClick={() => onAction(goal, 'approve')}>✅ Approve</ActionBtn>
                            <ActionBtn color="red"   onClick={() => onAction(goal, 'reject')}>❌ Reject</ActionBtn>
                        </>
                    )}
                    {isPayable && (
                        <ActionBtn color="purple" onClick={() => onAction(goal, 'mark-paid')} glow>
                            💸 Mark as Paid
                        </ActionBtn>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginLeft: 'auto' }}>
                        {new Date(goal.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                </div>
            </div>
        </div>
    );
}

function ActionBtn({ onClick, color, children, glow }) {
    const colors = {
        green:  { bg: 'linear-gradient(135deg,#22c55e,#16a34a)', text: '#fff', shadow: 'rgba(34,197,94,0.35)' },
        red:    { bg: 'rgba(248,113,113,0.1)', text: '#f87171', border: '1px solid rgba(248,113,113,0.35)', shadow: 'none' },
        purple: { bg: 'linear-gradient(135deg,#9333ea,#a855f7)', text: '#fff', shadow: 'rgba(168,85,247,0.4)' },
    };
    const c = colors[color] || colors.green;
    return (
        <button
            onClick={onClick}
            style={{
                padding: '9px 18px', borderRadius: 12, border: c.border || 'none',
                background: c.bg, color: c.text, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: glow ? `0 4px 18px ${c.shadow}` : 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; if (glow) e.currentTarget.style.boxShadow = `0 8px 28px ${c.shadow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; if (glow) e.currentTarget.style.boxShadow = `0 4px 18px ${c.shadow}`; }}
        >
            {children}
        </button>
    );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ goal, actionType, onConfirm, onCancel, submitting }) {
    const [reason, setReason] = useState('');
    const needsReason = actionType === 'reject';
    const isPaid = actionType === 'mark-paid';

    const META = {
        approve:    { title: '✅ Approve Goal?',      desc: 'This goal will go live and fans can contribute.',     btnBg: 'linear-gradient(135deg,#22c55e,#16a34a)' },
        reject:     { title: '❌ Reject Goal',         desc: 'Provide a clear reason — it will be sent to creator.', btnBg: 'linear-gradient(135deg,#ef4444,#dc2626)' },
        'mark-paid':{ title: '💸 Mark as Paid?',       desc: 'This confirms funds have been released to the creator and cannot be undone.',  btnBg: 'linear-gradient(135deg,#9333ea,#a855f7)' },
    };
    const m = META[actionType] || META.approve;

    return (
        <div onClick={e => e.target === e.currentTarget && onCancel()} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'linear-gradient(145deg,#1a0b2e,#0d0718)', border: `1px solid ${needsReason ? 'rgba(248,113,113,0.25)' : isPaid ? 'rgba(168,85,247,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 24, padding: '28px 24px', maxWidth: 440, width: '100%', boxShadow: '0 40px 100px rgba(0,0,0,0.9)', animation: 'df-admin-fadeUp 0.2s ease' }}>
                <style>{`@keyframes df-admin-fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }`}</style>
                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 0 6px', letterSpacing: '-0.02em' }}>{m.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 18px', lineHeight: 1.5 }}>
                    <strong style={{ color: '#e2e2e2' }}>{goal.title}</strong> by <strong style={{ color: '#e2e2e2' }}>{goal.creatorId?.name}</strong>
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 18px', lineHeight: 1.5 }}>{m.desc}</p>

                {isPaid && (
                    <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', marginBottom: 18 }}>
                        <p style={{ color: '#c084fc', fontSize: 13, fontWeight: 700, margin: 0 }}>
                            Creator will receive ₹{fmt(R(goal.currentAmount * CREATOR_SHARE))} (80% of ₹{fmt(R(goal.currentAmount))})
                        </p>
                    </div>
                )}

                {needsReason && (
                    <div style={{ marginBottom: 18 }}>
                        <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
                            Rejection Reason <span style={{ color: '#f87171' }}>*</span>
                        </label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain clearly so the creator can fix and resubmit…" rows={3} autoFocus
                            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, resize: 'vertical', background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color 0.15s', fontFamily: 'inherit' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.55)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => onConfirm(reason)} disabled={submitting || (needsReason && !reason.trim())} style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', background: m.btnBg, color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting || (needsReason && !reason.trim()) ? 0.6 : 1, transition: 'all 0.15s' }}>
                        {submitting ? 'Processing…' : 'Confirm'}
                    </button>
                    <button onClick={onCancel} disabled={submitting} style={{ flex: 1, height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }) {
    if (!msg) return null;
    return (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: ok ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(13,7,24,0.98))' : 'linear-gradient(135deg,rgba(248,113,113,0.15),rgba(13,7,24,0.98))', border: `1px solid ${ok ? 'rgba(34,197,94,0.4)' : 'rgba(248,113,113,0.4)'}`, borderRadius: 14, padding: '14px 18px', color: ok ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 13, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', animation: 'df-admin-slideIn 0.3s ease', maxWidth: 320 }}>
            <style>{`@keyframes df-admin-slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }`}</style>
            {msg}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDreamFunds() {
    const [allGoals, setAllGoals] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('pending');
    const [actionGoal, setActionGoal] = useState(null);
    const [actionType, setActionType] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast]       = useState({ msg: '', ok: true });
    const toastTimer              = useRef(null);

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast({ msg: '', ok: true }), 3800);
    };

    const loadGoals = useCallback(() => {
        setLoading(true);
        // Load all goals — we filter client-side per tab (avoids N requests)
        dreamFundService.adminListDreamFunds()
            .then(r  => setAllGoals(r.data.data || []))
            .catch(() => showToast('Failed to load Dream Fund goals', false))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    // Derive filtered lists per tab
    const currentTab  = TABS.find(t => t.key === tab) || TABS[0];
    const filteredGoals = allGoals.filter(g => currentTab.statusKeys.includes(g.status));

    // Stats — computed from allGoals so tabs always show correct counts
    const counts = TABS.reduce((acc, t) => {
        acc[t.key] = allGoals.filter(g => t.statusKeys.includes(g.status)).length;
        return acc;
    }, {});

    const handleConfirm = async (reason) => {
        if (!actionGoal) return;
        setSubmitting(true);
        try {
            if (actionType === 'approve')    await dreamFundService.adminApproveGoal(actionGoal._id);
            else if (actionType === 'reject') await dreamFundService.adminRejectGoal(actionGoal._id, reason);
            else if (actionType === 'mark-paid') await dreamFundService.adminMarkPaid(actionGoal._id);

            showToast(
                actionType === 'approve'    ? '✅ Goal approved and now live!' :
                actionType === 'reject'     ? '❌ Goal rejected, creator notified' :
                                              '💸 Marked as paid! Creator has been notified.'
            );
            setActionGoal(null);
            loadGoals();
        } catch (e) {
            showToast('❌ ' + (e?.response?.data?.message || e.message), false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                .admin-df-shimmer {
                    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%);
                    background-size: 200% 100%;
                    animation: dfShimmer 1.8s infinite;
                }
                @keyframes dfShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                .adf-tab-btn { transition: all 0.15s ease; cursor: pointer; white-space: nowrap; }
                .adf-tab-btn:hover { opacity: 0.85; }
            `}</style>

            <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px,3vw,32px)' }}>

                {/* ── Header ──────────────────────────────────────────────── */}
                <div style={{ marginBottom: 28 }}>
                    <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(20px,4vw,28px)', margin: 0, letterSpacing: '-0.03em' }}>
                        🌟 Dream Fund Management
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, margin: '6px 0 0' }}>
                        Review goals, approve campaigns, and release payments to creators
                    </p>
                </div>

                {/* ── Stats Strip ─────────────────────────────────────────── */}
                {!loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
                        {TABS.map(t => (
                            <div key={t.key} onClick={() => setTab(t.key)} style={{ padding: '12px 14px', borderRadius: 16, background: tab === t.key ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)', border: tab === t.key ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.07)', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                                <div style={{ fontSize: 16, marginBottom: 4 }}>{t.emoji}</div>
                                <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{counts[t.key]}</div>
                                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>{t.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Tab Bar ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
                    {TABS.map(t => {
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key} className="adf-tab-btn" onClick={() => setTab(t.key)}
                                style={{ padding: '8px 18px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)', background: active ? 'linear-gradient(135deg,#9333ea,#ec4899)' : 'rgba(255,255,255,0.04)', color: active ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: active ? '0 4px 16px rgba(147,51,234,0.35)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                {t.emoji} {t.label}
                                {counts[t.key] > 0 && (
                                    <span style={{ background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', padding: '1px 7px', borderRadius: 999, fontSize: 11 }}>
                                        {counts[t.key]}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {/* Refresh */}
                    <button onClick={loadGoals} className="adf-tab-btn" style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                        ↻ Refresh
                    </button>
                </div>

                {/* ── Empty state for tab requiring action ─────────────────── */}
                {tab === 'pending' && !loading && filteredGoals.length === 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 18 }}>
                        <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, margin: 0 }}>✅ All caught up — no pending goals awaiting review!</p>
                    </div>
                )}
                {tab === 'completed' && !loading && filteredGoals.length > 0 && (
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', marginBottom: 18 }}>
                        <p style={{ color: '#c084fc', fontSize: 13, fontWeight: 700, margin: 0 }}>🏆 {filteredGoals.length} goal{filteredGoals.length !== 1 ? 's' : ''} reached target — click <strong>Mark as Paid</strong> to release funds to creators.</p>
                    </div>
                )}

                {/* ── List ─────────────────────────────────────────────────── */}
                {loading ? <Skeleton /> : filteredGoals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: 48, marginBottom: 14 }}>{currentTab.emoji}</div>
                        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: '0 0 6px' }}>No {currentTab.label.toLowerCase()} goals</h3>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Nothing to show in this section right now.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {filteredGoals.map(goal => (
                            <GoalCard
                                key={goal._id} goal={goal}
                                onAction={(g, type) => { setActionGoal(g); setActionType(type); }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Toast ───────────────────────────────────────────────────── */}
            <Toast msg={toast.msg} ok={toast.ok} />

            {/* ── Confirm dialog ───────────────────────────────────────────── */}
            {actionGoal && (
                <ConfirmDialog
                    goal={actionGoal} actionType={actionType}
                    submitting={submitting}
                    onConfirm={handleConfirm}
                    onCancel={() => setActionGoal(null)}
                />
            )}
        </div>
    );
}
