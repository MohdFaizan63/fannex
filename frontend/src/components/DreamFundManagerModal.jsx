import { useState, useEffect, useRef, useCallback } from 'react';
import dreamFundService from '../services/dreamFundService';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE = 0.20;   // 20% platform
const CREATOR_SHARE = 0.80;  // 80% creator

const MAX_GOALS = 3;
const ACTIVE_STATUSES = ['pending', 'approved', 'completed', 'awaiting_verification', 'verified'];

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS = {
    pending:              { label: 'Pending Approval', emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' },
    approved:             { label: 'Active',           emoji: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.25)'  },
    rejected:             { label: 'Rejected',         emoji: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
    completed:            { label: 'Completed',        emoji: '🎉', color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.25)' },
    awaiting_verification:{ label: 'Awaiting Proof Verification', emoji: '📎', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)' },
    verified:             { label: 'Verified',         emoji: '✓',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString('en-IN');
const R   = (n) => Math.round((n || 0) * 100) / 100;

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'df-spin 0.8s linear infinite' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2"/>
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color = 'linear-gradient(90deg,#9333ea,#ec4899)' }) {
    return (
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
    );
}

// ─── Balance Panel ────────────────────────────────────────────────────────────
function BalancePanel({ goals }) {
    // Aggregate totals from all goals (excluding rejected)
    const activeGoals = goals.filter(g => ACTIVE_STATUSES.includes(g.status));
    const totalRaised = activeGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const totalTarget = activeGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);

    // 80/20 split
    const creatorEarning = R(totalRaised * CREATOR_SHARE);
    const platformFeeAmt = R(totalRaised * PLATFORM_FEE);

    // Verified goals = already paid out
    const verifiedRaised = goals.filter(g => g.status === 'verified').reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const verifiedCreator = R(verifiedRaised * CREATOR_SHARE);

    const cards = [
        {
            label: 'Total Raised',
            value: `₹${fmt(R(totalRaised))}`,
            sub: `of ₹${fmt(R(totalTarget))} target`,
            icon: '💰',
            grad: 'linear-gradient(135deg,#9333ea22,#ec489912)',
            border: 'rgba(147,51,234,0.25)',
        },
        {
            label: 'Your Earnings (80%)',
            value: `₹${fmt(creatorEarning)}`,
            sub: `Platform keeps ₹${fmt(platformFeeAmt)} (20%)`,
            icon: '🏦',
            grad: 'linear-gradient(135deg,#22c55e22,#4ade8012)',
            border: 'rgba(34,197,94,0.25)',
        },
        {
            label: 'Verified & Paid',
            value: `₹${fmt(verifiedCreator)}`,
            sub: 'After proof verification',
            icon: '✅',
            grad: 'linear-gradient(135deg,#60a5fa22,#818cf812)',
            border: 'rgba(96,165,250,0.25)',
        },
    ];

    return (
        <div style={{ marginBottom: 20 }}>
            {/* Section title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg,#9333ea,#ec4899)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Earnings Overview
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {cards.map((c) => (
                    <div key={c.label} style={{ background: c.grad, border: `1px solid ${c.border}`, borderRadius: 14, padding: '12px 10px' }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{c.icon}</div>
                        <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0, letterSpacing: '-0.02em' }}>
                            {c.value}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, margin: '4px 0 0', lineHeight: 1.4 }}>
                            {c.label}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: '2px 0 0', lineHeight: 1.4 }}>
                            {c.sub}
                        </p>
                    </div>
                ))}
            </div>

            {/* 80/20 split info bar */}
            {totalRaised > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: '80%', background: 'linear-gradient(90deg,#9333ea,#ec4899)', borderRadius: '999px 0 0 999px' }} />
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: '0 999px 999px 0' }} />
                        </div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, whiteSpace: 'nowrap' }}>
                        80% you · 20% platform
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, onUploadProof }) {
    const pct = goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
        : 0;
    const st = STATUS[goal.status] || STATUS.pending;
    const creatorShare = R(goal.currentAmount * CREATOR_SHARE);

    return (
        <div style={{
            background: 'rgba(255,255,255,0.035)',
            border: `1px solid ${st.border}`,
            borderRadius: 16,
            padding: '14px 16px',
            transition: 'border-color 0.2s',
        }}>
            {/* Goal header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Status badge */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: st.bg, border: `1px solid ${st.border}`, marginBottom: 6 }}>
                        <span style={{ fontSize: 10 }}>{st.emoji}</span>
                        <span style={{ color: st.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>{st.label}</span>
                    </div>
                    <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>
                        {goal.title}
                    </h4>
                    {goal.description && (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '4px 0 0', lineHeight: 1.5 }}>
                            {goal.description.length > 80 ? goal.description.slice(0, 80) + '…' : goal.description}
                        </p>
                    )}
                </div>
                {goal.image && (
                    <img src={goal.image} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }} />
                )}
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 5 }}>
                    <span>₹{fmt(R(goal.currentAmount))} raised</span>
                    <span style={{ fontWeight: 700, color: st.color }}>{pct}%</span>
                    <span>₹{fmt(R(goal.targetAmount))} goal</span>
                </div>
                <ProgressBar pct={pct} />
            </div>

            {/* Financials split */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: '7px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your 80%</p>
                    <p style={{ color: '#4ade80', fontWeight: 800, fontSize: 13, margin: 0 }}>₹{fmt(creatorShare)}</p>
                </div>
                <div style={{ flex: 1, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supporters</p>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 13, margin: 0 }}>❤️ {goal.supporterCount || 0}</p>
                </div>
            </div>

            {/* Rejection reason */}
            {goal.status === 'rejected' && goal.rejectionReason && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 8 }}>
                    <p style={{ color: '#f87171', fontSize: 11, fontWeight: 700, margin: 0 }}>
                        ⚠️ Reason: {goal.rejectionReason}
                    </p>
                </div>
            )}

            {/* Upload proof CTA */}
            {goal.status === 'completed' && (
                <button
                    onClick={() => onUploadProof(goal)}
                    style={{
                        width: '100%', padding: '9px 0', borderRadius: 10,
                        border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.12)',
                        color: '#c084fc', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        marginTop: 2, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.22)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.12)'; }}
                >
                    📎 Upload Achievement Proof
                </button>
            )}
        </div>
    );
}

// ─── Styled Input ─────────────────────────────────────────────────────────────
function StyledInput({ label, required, hint, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {label} {required && <span style={{ color: '#f87171' }}>*</span>}
                </span>
                {hint && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{hint}</span>}
            </label>
            {children}
        </div>
    );
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────
function FileDropZone({ inputRef, accept, label, hint }) {
    const [fileName, setFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);

    const handleChange = (e) => {
        const file = e.target.files?.[0];
        setFileName(file ? file.name : '');
    };

    return (
        <div
            style={{
                border: `2px dashed ${dragOver ? 'rgba(147,51,234,0.6)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 14, padding: '18px 16px', textAlign: 'center',
                background: dragOver ? 'rgba(147,51,234,0.08)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
                e.preventDefault(); setDragOver(false);
                if (inputRef.current && e.dataTransfer.files[0]) {
                    const dt = new DataTransfer();
                    dt.items.add(e.dataTransfer.files[0]);
                    inputRef.current.files = dt.files;
                    setFileName(e.dataTransfer.files[0].name);
                }
            }}
            onClick={() => inputRef.current?.click()}
        >
            <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleChange} />
            {fileName ? (
                <>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                    <p style={{ color: '#a855f7', fontSize: 12, fontWeight: 700, margin: 0 }}>{fileName}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '4px 0 0' }}>Click to change</p>
                </>
            ) : (
                <>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, margin: 0 }}>{label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '4px 0 0' }}>{hint}</p>
                </>
            )}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function DreamFundManagerModal({ onClose }) {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list');  // 'list' | 'create' | 'proof'
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const imageRef = useRef(null);
    const proofRef  = useRef(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [onClose]);

    const loadGoals = useCallback(() => {
        setLoading(true);
        dreamFundService.getMyGoals()
            .then(r => setGoals(r.data.data || []))
            .catch(() => setGoals([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const goTo = (v) => { setView(v); setError(''); setSuccess(''); };

    // ── Active slots count (verified goals are done — allow new ones in their place) ──
    // Bug Fix: verified goals should NOT count against the 3-goal limit
    const activeCount = goals.filter(g =>
        ['pending', 'approved', 'completed', 'awaiting_verification'].includes(g.status)
    ).length;
    const slotsLeft = MAX_GOALS - activeCount;
    const canCreate = slotsLeft > 0;

    // ── Create ────────────────────────────────────────────────────────────────
    const handleCreate = async () => {
        setError(''); setSuccess('');
        if (!title.trim()) { setError('Goal title is required'); return; }
        if (!targetAmount || Number(targetAmount) < 1) { setError('Target amount must be at least ₹1'); return; }
        if (!canCreate) { setError('You already have 3 active goals. Wait for one to complete.'); return; }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('description', description.trim());
            fd.append('targetAmount', targetAmount);
            if (imageRef.current?.files?.[0]) fd.append('file', imageRef.current.files[0]);

            await dreamFundService.createGoal(fd);
            setSuccess('🎉 Goal submitted for approval!');
            setTitle(''); setDescription(''); setTargetAmount('');
            if (imageRef.current) imageRef.current.value = '';
            loadGoals();
            setTimeout(() => goTo('list'), 1400);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to create goal. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Upload proof ──────────────────────────────────────────────────────────
    const handleUploadProof = async () => {
        setError(''); setSuccess('');
        if (!proofRef.current?.files?.[0]) { setError('Please select a proof image or video'); return; }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('file', proofRef.current.files[0]);
            await dreamFundService.uploadProof(selectedGoal._id, fd);
            setSuccess('📎 Proof uploaded! Awaiting admin verification.');
            loadGoals();
            setTimeout(() => goTo('list'), 1400);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to upload proof.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Common input style ────────────────────────────────────────────────────
    const INPUT = {
        width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14, fontWeight: 500,
        background: 'rgba(255,255,255,0.055)', border: '1.5px solid rgba(255,255,255,0.11)',
        color: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
        fontFamily: 'inherit',
    };
    const focusBorder = 'rgba(147,51,234,0.7)';
    const bindInput = { onFocus: e => e.target.style.borderColor = focusBorder, onBlur: e => e.target.style.borderColor = 'rgba(255,255,255,0.11)' };

    // ── Submit button ─────────────────────────────────────────────────────────
    const SubmitBtn = ({ onClick, label, loadingLabel }) => (
        <button
            onClick={onClick} disabled={submitting}
            style={{
                width: '100%', height: 50, borderRadius: 14, border: 'none',
                background: submitting ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#9333ea,#ec4899)',
                color: submitting ? 'rgba(255,255,255,0.3)' : '#fff',
                fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4, transition: 'all 0.2s', boxShadow: submitting ? 'none' : '0 4px 24px rgba(147,51,234,0.35)',
            }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
            {submitting ? <><Spinner size={16} /> {loadingLabel}</> : label}
        </button>
    );

    return (
        <>
            {/* CSS animations */}
            <style>{`
                @keyframes df-spin { to { transform: rotate(360deg); } }
                @keyframes df-fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
                .df-modal-card { animation: df-fadeUp 0.3s cubic-bezier(.4,0,.2,1); }
                .df-goal-slot { width:10px; height:10px; border-radius:50%; transition:all 0.2s; }
                .df-goal-slot.used { background:linear-gradient(135deg,#9333ea,#ec4899); }
                .df-goal-slot.empty { background:rgba(255,255,255,0.12); border:1.5px solid rgba(255,255,255,0.2); }
            `}</style>

            <div
                onClick={e => e.target === e.currentTarget && onClose()}
                style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', padding: '16px' }}
            >
                <div
                    className="df-modal-card"
                    style={{
                        background: 'linear-gradient(160deg,#13071f 0%,#0e0618 60%,#060311 100%)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 24, padding: '24px 22px', width: '100%', maxWidth: 500,
                        boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(147,51,234,0.08)',
                        maxHeight: '92vh', overflowY: 'auto',
                    }}
                >
                    {/* ── Top Header ─────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 19, margin: 0, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🌟 Dream Fund Manager
                            </h2>
                            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: '5px 0 0' }}>
                                {view === 'list' ? 'Manage your fundraising goals' : view === 'create' ? 'Create a new goal' : 'Upload achievement proof'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {view !== 'list' && (
                                <button
                                    onClick={() => goTo('list')}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    ← Back
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            >✕</button>
                        </div>
                    </div>

                    {/* ── Goal slots indicator (list view only) ─────────── */}
                    {view === 'list' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {Array.from({ length: MAX_GOALS }).map((_, i) => (
                                    <div key={i} className={`df-goal-slot ${i < activeCount ? 'used' : 'empty'}`} />
                                ))}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>
                                {activeCount}/{MAX_GOALS} slots used
                            </span>
                            {!canCreate && (
                                <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                                    ⚠️ Slots full
                                </span>
                            )}
                            {canCreate && slotsLeft > 0 && (
                                <span style={{ marginLeft: 'auto', color: '#4ade80', fontSize: 10, fontWeight: 700 }}>
                                    ✓ {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} available
                                </span>
                            )}
                        </div>
                    )}

                    {/* ── Alerts ───────────────────────────────────────────── */}
                    {error && (
                        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
                            ⚠️ {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
                            {success}
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════ */}
                    {/* LIST VIEW                                              */}
                    {/* ══════════════════════════════════════════════════════ */}
                    {view === 'list' && (
                        <>
                            {/* Balance Panel */}
                            {goals.length > 0 && <BalancePanel goals={goals} />}

                            {/* Goals */}
                            {loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[1, 2].map(i => (
                                        <div key={i} style={{ height: 100, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'df-spin 2s linear infinite', animationName: 'pulse' }} />
                                    ))}
                                </div>
                            ) : goals.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>No goals yet</p>
                                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Create your first Dream Fund goal and let fans support you.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                                    {goals.map(g => (
                                        <GoalCard
                                            key={g._id} goal={g}
                                            onUploadProof={(goal) => { setSelectedGoal(goal); goTo('proof'); }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Add goal button */}
                            {canCreate && (
                                <button
                                    onClick={() => goTo('create')}
                                    style={{
                                        width: '100%', height: 50, borderRadius: 14, border: 'none',
                                        background: 'linear-gradient(135deg,#9333ea,#ec4899)',
                                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                                        boxShadow: '0 4px 24px rgba(147,51,234,0.35)', transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(147,51,234,0.5)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(147,51,234,0.35)'; }}
                                >
                                    ✦ Add Dream Fund Goal
                                </button>
                            )}
                        </>
                    )}

                    {/* ══════════════════════════════════════════════════════ */}
                    {/* CREATE VIEW                                            */}
                    {/* ══════════════════════════════════════════════════════ */}
                    {view === 'create' && (
                        <div>
                            {/* Revenue info banner */}
                            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 18 }}>
                                <p style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, margin: 0 }}>
                                    💡 You earn 80% of every contribution — 20% is the platform fee
                                </p>
                            </div>

                            <StyledInput label="Goal Title" required>
                                <input
                                    type="text" value={title} placeholder='e.g. "Buy a new camera"'
                                    maxLength={120} style={INPUT} {...bindInput}
                                    onChange={e => setTitle(e.target.value)}
                                />
                                {title && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, margin: '3px 0 0', textAlign: 'right' }}>{title.length}/120</p>}
                            </StyledInput>

                            <StyledInput label="Target Amount (₹)" required hint="Min ₹1">
                                <input
                                    type="number" value={targetAmount} placeholder="e.g. 50,000"
                                    min={1} max={5000000} style={INPUT} {...bindInput}
                                    onChange={e => setTargetAmount(e.target.value)}
                                />
                                {targetAmount && Number(targetAmount) > 0 && (
                                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '3px 0 0' }}>
                                        You'll receive ≈ ₹{fmt(R(Number(targetAmount) * CREATOR_SHARE))} after platform fee
                                    </p>
                                )}
                            </StyledInput>

                            <StyledInput label="Description" hint="Optional">
                                <textarea
                                    value={description} placeholder="Tell your fans what this goal means to you…"
                                    maxLength={1000} rows={3}
                                    style={{ ...INPUT, resize: 'vertical' }} {...bindInput}
                                    onChange={e => setDescription(e.target.value)}
                                />
                                {description && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, margin: '3px 0 0', textAlign: 'right' }}>{description.length}/1000</p>}
                            </StyledInput>

                            <StyledInput label="Goal Image" hint="Optional">
                                <FileDropZone inputRef={imageRef} accept="image/*" label="Drag & drop or click to upload" hint="JPG, PNG, WEBP" />
                            </StyledInput>

                            <SubmitBtn onClick={handleCreate} label="🚀 Submit for Approval" loadingLabel="Submitting…" />
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                                Goals require admin approval before appearing on your profile
                            </p>
                        </div>
                    )}

                    {/* ══════════════════════════════════════════════════════ */}
                    {/* PROOF UPLOAD VIEW                                      */}
                    {/* ══════════════════════════════════════════════════════ */}
                    {view === 'proof' && selectedGoal && (
                        <div>
                            {/* Goal summary */}
                            <div style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.22)', marginBottom: 20 }}>
                                <p style={{ color: '#c084fc', fontWeight: 800, fontSize: 14, margin: '0 0 6px' }}>
                                    🏆 {selectedGoal.title}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                    <span>Raised: <strong style={{ color: '#fff' }}>₹{fmt(R(selectedGoal.currentAmount))}</strong></span>
                                    <span>Your 80%: <strong style={{ color: '#4ade80' }}>₹{fmt(R(selectedGoal.currentAmount * CREATOR_SHARE))}</strong></span>
                                    <span>Goal: <strong style={{ color: '#fff' }}>₹{fmt(R(selectedGoal.targetAmount))}</strong></span>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    <ProgressBar pct={100} />
                                </div>
                            </div>

                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
                                🎉 Congratulations! Upload a photo or video proving you achieved your goal. This will be reviewed by our admin before your funds are released.
                            </p>

                            <StyledInput label="Proof File" required hint="Image or video, max 50MB">
                                <FileDropZone inputRef={proofRef} accept="image/*,video/*" label="Drag & drop proof file" hint="JPG, PNG, MP4, MOV — max 50MB" />
                            </StyledInput>

                            <SubmitBtn onClick={handleUploadProof} label="📎 Submit Proof" loadingLabel="Uploading…" />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
