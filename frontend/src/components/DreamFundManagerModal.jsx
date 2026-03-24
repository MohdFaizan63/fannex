import { useState, useEffect, useRef, useCallback } from 'react';
import dreamFundService from '../services/dreamFundService';

// ─── Image URL helper ─────────────────────────────────────────────────────────
const API_ORIGIN = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'https://api.fannex.in';

function getImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_ORIGIN}${url}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CREATOR_SHARE = 0.80;
const PLATFORM_FEE  = 0.20;
const MAX_GOALS = 3;

const fmt = (n) => (n || 0).toLocaleString('en-IN');
const R   = (n) => Math.round((n || 0) * 100) / 100;

// ─── Status visual config ─────────────────────────────────────────────────────
const STATUS = {
    pending:               { label: 'Pending',          emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.28)'   },
    approved:              { label: 'Active',            emoji: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',    border: 'rgba(34,197,94,0.28)'    },
    rejected:              { label: 'Rejected',          emoji: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.28)'  },
    completed:             { label: 'Goal Reached',      emoji: '🏆', color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  border: 'rgba(168,85,247,0.28)'   },
    awaiting_verification: { label: 'Awaiting Review',   emoji: '📋', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.28)'   },
    verified:              { label: 'Verified',          emoji: '✓',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.28)'   },
    paid:                  { label: 'Paid! ✓',           emoji: '💸', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.28)'   },
};

// ─── Section tabs for creator view ───────────────────────────────────────────
const SECTIONS = [
    { key: 'active',    label: 'Active',    emoji: '✅', filter: g => g.status === 'approved' },
    { key: 'pending',   label: 'Pending',   emoji: '⏳', filter: g => g.status === 'pending' },
    { key: 'completed', label: 'Completed', emoji: '🏆', filter: g => ['completed','awaiting_verification','verified','paid'].includes(g.status) },
    { key: 'rejected',  label: 'Rejected',  emoji: '❌', filter: g => g.status === 'rejected' },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, glow }) {
    return (
        <div style={{ height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#9333ea,#ec4899)', boxShadow: glow ? (pct >= 100 ? '0 0 10px rgba(34,197,94,0.5)' : '0 0 8px rgba(168,85,247,0.4)') : 'none', transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
    );
}

// ─── Balance banner ───────────────────────────────────────────────────────────
function BalanceBanner({ goals }) {
    const activeGoals  = goals.filter(g => !['rejected'].includes(g.status));
    const totalRaised  = activeGoals.reduce((s, g) => s + (g.currentAmount || 0), 0);
    const creatorEarns = R(totalRaised * CREATOR_SHARE);
    const paidGoals    = goals.filter(g => g.status === 'paid');
    const totalPaid    = R(paidGoals.reduce((s, g) => s + (g.currentAmount || 0), 0) * CREATOR_SHARE);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
                { icon: '💰', label: 'Total Raised',   value: `₹${fmt(R(totalRaised))}`, sub: 'from all goals',             grad: 'rgba(147,51,234,0.12)',  border: 'rgba(147,51,234,0.25)' },
                { icon: '🏦', label: 'Your 80%',       value: `₹${fmt(creatorEarns)}`,   sub: `Platform: ₹${fmt(R(totalRaised * PLATFORM_FEE))}`, grad: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.22)' },
                { icon: '💸', label: 'Paid Out',        value: `₹${fmt(totalPaid)}`,      sub: 'after admin payout',         grad: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.22)' },
            ].map(c => (
                <div key={c.label} style={{ background: c.grad, border: `1px solid ${c.border}`, borderRadius: 14, padding: '11px 10px' }}>
                    <div style={{ fontSize: 16, marginBottom: 5 }}>{c.icon}</div>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0, letterSpacing: '-0.02em' }}>{c.value}</p>
                    <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 9, margin: '4px 0 0', lineHeight: 1.4 }}>{c.label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 8, margin: '2px 0 0' }}>{c.sub}</p>
                </div>
            ))}
            {/* 80/20 split bar */}
            {totalRaised > 0 && (
                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: '80%', background: 'linear-gradient(90deg,#9333ea,#ec4899)', borderRadius: '999px 0 0 999px' }} />
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: '0 999px 999px 0' }} />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, whiteSpace: 'nowrap' }}>80% you · 20% platform</span>
                </div>
            )}
        </div>
    );
}

// ─── Single Goal Card ────────────────────────────────────────────────────────
function GoalCard({ goal }) {
    const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
    const st  = STATUS[goal.status] || STATUS.pending;
    const creatorShare = R((goal.currentAmount || 0) * CREATOR_SHARE);

    return (
        <div style={{ background: 'rgba(255,255,255,0.034)', border: `1px solid ${st.border}`, borderRadius: 16, padding: '14px 15px', transition: 'border-color 0.2s' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: st.bg, border: `1px solid ${st.border}`, marginBottom: 5 }}>
                        <span style={{ fontSize: 9 }}>{st.emoji}</span>
                        <span style={{ color: st.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>{st.label}</span>
                    </div>
                    <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0, lineHeight: 1.3, wordBreak: 'break-word' }}>{goal.title}</h4>
                    {goal.description && (
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, margin: '4px 0 0', lineHeight: 1.5 }}>
                            {goal.description.length > 90 ? goal.description.slice(0, 90) + '…' : goal.description}
                        </p>
                    )}
                </div>
                {goal.image && (
                    <img src={getImageUrl(goal.image)} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => e.target.style.display = 'none'} />
                )}
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
                    <span>₹{fmt(R(goal.currentAmount))} raised</span>
                    <span style={{ fontWeight: 700, color: st.color }}>{pct}%</span>
                    <span>₹{fmt(R(goal.targetAmount))} goal</span>
                </div>
                <ProgressBar pct={pct} glow />
            </div>

            {/* Financial split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: goal.rejectionReason ? 10 : 0 }}>
                <div style={{ padding: '7px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your 80%</p>
                    <p style={{ color: '#4ade80', fontWeight: 800, fontSize: 13, margin: 0 }}>₹{fmt(creatorShare)}</p>
                </div>
                <div style={{ padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supporters</p>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 13, margin: 0 }}>❤️ {goal.supporterCount || 0}</p>
                </div>
            </div>

            {/* Paid badge */}
            {goal.status === 'paid' && (
                <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <p style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, margin: 0 }}>
                        💸 Admin has released your payment! Funds are on their way.
                    </p>
                </div>
            )}

            {/* Completion info */}
            {['completed','awaiting_verification','verified'].includes(goal.status) && (
                <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <p style={{ color: '#c084fc', fontSize: 11, fontWeight: 700, margin: 0 }}>
                        🎉 Goal reached! Admin will review and release your payment soon.
                    </p>
                </div>
            )}

            {/* Rejection reason */}
            {goal.status === 'rejected' && goal.rejectionReason && (
                <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <p style={{ color: '#f87171', fontSize: 11, fontWeight: 700, margin: 0 }}>⚠️ Reason: {goal.rejectionReason}</p>
                </div>
            )}
        </div>
    );
}

// ─── Section with goals list ──────────────────────────────────────────────────
function GoalSection({ goals, emptyMsg }) {
    if (goals.length === 0) return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📭</div>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>{emptyMsg}</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goals.map(g => <GoalCard key={g._id} goal={g} />)}
        </div>
    );
}

// ─── File drop zone ────────────────────────────────────────────────────────────
function FileDropZone({ inputRef, accept, label, hint }) {
    const [fileName, setFileName] = useState('');
    const [drag, setDrag] = useState(false);
    return (
        <div
            style={{ border: `2px dashed ${drag ? 'rgba(147,51,234,0.6)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '18px 16px', textAlign: 'center', background: drag ? 'rgba(147,51,234,0.08)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); if (inputRef.current && e.dataTransfer.files[0]) { const dt = new DataTransfer(); dt.items.add(e.dataTransfer.files[0]); inputRef.current.files = dt.files; setFileName(e.dataTransfer.files[0].name); } }}
        >
            <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
            <div style={{ fontSize: 24, marginBottom: 5 }}>{fileName ? '📄' : '☁️'}</div>
            <p style={{ color: fileName ? '#a855f7' : 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700, margin: 0 }}>{fileName || label}</p>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, margin: '4px 0 0' }}>{fileName ? 'Click to change' : hint}</p>
        </div>
    );
}

// ─── Create form ──────────────────────────────────────────────────────────────
function CreateForm({ onBack, onSuccess }) {
    const [title, setTitle]               = useState('');
    const [description, setDescription]   = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [submitting, setSubmitting]     = useState(false);
    const [error, setError]               = useState('');
    const imageRef = useRef(null);

    const INPUT = { width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14, fontWeight: 500, background: 'rgba(255,255,255,0.055)', border: '1.5px solid rgba(255,255,255,0.11)', color: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: 'inherit' };
    const bind  = { onFocus: e => e.target.style.borderColor = 'rgba(147,51,234,0.7)', onBlur: e => e.target.style.borderColor = 'rgba(255,255,255,0.11)' };

    const handleSubmit = async () => {
        setError('');
        if (!title.trim()) { setError('Goal title is required'); return; }
        if (!targetAmount || Number(targetAmount) < 1) { setError('Target amount must be at least ₹1'); return; }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('title', title.trim()); fd.append('description', description.trim()); fd.append('targetAmount', targetAmount);
            if (imageRef.current?.files?.[0]) fd.append('file', imageRef.current.files[0]);
            await dreamFundService.createGoal(fd);
            onSuccess('🎉 Goal submitted for admin approval!');
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to create goal');
        } finally { setSubmitting(false); }
    };

    return (
        <div>
            {/* Revenue info */}
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 18 }}>
                <p style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, margin: 0 }}>💡 You earn 80% of every contribution — 20% is the platform fee</p>
            </div>

            {error && <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>⚠️ {error}</div>}

            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Goal Title <span style={{ color: '#f87171' }}>*</span></label>
            <input type="text" value={title} placeholder='"Buy a new camera"' maxLength={120} style={{ ...INPUT, marginBottom: 14 }} {...bind} onChange={e => setTitle(e.target.value)} />
            {title && <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10, margin: '-10px 0 14px', textAlign: 'right' }}>{title.length}/120</p>}

            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Target Amount (₹) <span style={{ color: '#f87171' }}>*</span></label>
            <input type="number" value={targetAmount} placeholder="e.g. 50,000" min={1} max={5000000} style={{ ...INPUT, marginBottom: 4 }} {...bind} onChange={e => setTargetAmount(e.target.value)} />
            {targetAmount && Number(targetAmount) > 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 14 }}>You'll receive ≈ ₹{fmt(R(Number(targetAmount) * CREATOR_SHARE))} after platform fee</p>}

            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Description <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 500, fontSize: 9 }}>(optional)</span></label>
            <textarea value={description} placeholder="Tell your fans what this goal means to you…" maxLength={1000} rows={3} style={{ ...INPUT, resize: 'vertical', marginBottom: description ? 4 : 14 }} {...bind} onChange={e => setDescription(e.target.value)} />
            {description && <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10, margin: '0 0 14px', textAlign: 'right' }}>{description.length}/1000</p>}

            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Goal Image <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 500, fontSize: 9 }}>(optional)</span></label>
            <div style={{ marginBottom: 18 }}><FileDropZone inputRef={imageRef} accept="image/*" label="Drag & drop or click to upload" hint="JPG, PNG, WEBP — max 10MB" /></div>

            <button
                onClick={handleSubmit} disabled={submitting}
                style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', background: submitting ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#9333ea,#ec4899)', color: submitting ? 'rgba(255,255,255,0.3)' : '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 24px rgba(147,51,234,0.35)', transition: 'all 0.2s' }}
            >
                {submitting ? 'Submitting…' : '🚀 Submit for Approval'}
            </button>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>Goals require admin approval before appearing on your profile</p>
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function DreamFundManagerModal({ onClose }) {
    const [goals, setGoals]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(false);
    const [view, setView]     = useState('tabs');   // 'tabs' | 'create'
    const [activeTab, setTab] = useState('active');
    const [success, setSuccess] = useState('');

    // Lock body scroll
    useEffect(() => {
        const handler = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
    }, [onClose]);

    const loadGoals = useCallback(() => {
        setLoading(true);
        setError(false);
        dreamFundService.getMyGoals()
            .then(r => setGoals(r.data.data || []))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    // Active goal slot count (verified/paid are done — don't count against limit)
    const activeCount = goals.filter(g => ['pending','approved','completed','awaiting_verification'].includes(g.status)).length;
    const canCreate   = activeCount < MAX_GOALS;

    const handleCreateSuccess = (msg) => {
        setSuccess(msg);
        loadGoals();
        setTimeout(() => { setView('tabs'); setTab('pending'); setSuccess(''); }, 1500);
    };

    const currentSection = SECTIONS.find(s => s.key === activeTab) || SECTIONS[0];
    const sectionGoals   = currentSection.filter ? goals.filter(currentSection.filter) : goals;

    const sectionCounts = SECTIONS.reduce((acc, s) => { acc[s.key] = goals.filter(s.filter).length; return acc; }, {});

    const hasAnyGoals = goals.length > 0;

    return (
        <>
            <style>{`
                @keyframes df-fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                .df-modal-wrap { animation: df-fadeUp 0.28s cubic-bezier(.4,0,.2,1); }
                .df-tab:hover { opacity: 0.8; }
            `}</style>

            <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', padding: 16 }}>
                <div className="df-modal-wrap" style={{ background: 'linear-gradient(160deg,#13071f,#0e0618 60%,#060311)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '22px 20px', width: '100%', maxWidth: 500, boxShadow: '0 40px 100px rgba(0,0,0,0.85)', maxHeight: '92vh', overflowY: 'auto' }}>

                    {/* ── Header ─────────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div>
                            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 18, margin: 0, letterSpacing: '-0.03em' }}>🌟 Dream Fund Manager</h2>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '4px 0 0' }}>
                                {view === 'create' ? 'Create a new fundraising goal' : 'Manage your fundraising goals'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {view === 'create' && (
                                <button onClick={() => setView('tabs')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← Back</button>
                            )}
                            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                    </div>

                    {/* ── Success toast ─────────────────────────────────── */}
                    {success && (
                        <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{success}</div>
                    )}

                    {/* ──────────── TABS VIEW ──────────────────────────── */}
                    {view === 'tabs' && (
                        <>
                            {/* Balance banner */}
                            {hasAnyGoals && !loading && <BalanceBanner goals={goals} />}

                            {/* Goal slot indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {Array.from({ length: MAX_GOALS }).map((_, i) => (
                                        <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < activeCount ? 'linear-gradient(135deg,#9333ea,#ec4899)' : 'rgba(255,255,255,0.15)', border: i < activeCount ? 'none' : '1.5px solid rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
                                    ))}
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: 600 }}>{activeCount}/{MAX_GOALS} active slots used</span>
                                <span style={{ marginLeft: 'auto', color: canCreate ? '#4ade80' : '#f59e0b', fontSize: 10, fontWeight: 700 }}>
                                    {canCreate ? `✓ ${MAX_GOALS - activeCount} open` : '⚠️ Full'}
                                </span>
                            </div>

                            {/* Tab bar */}
                            {hasAnyGoals && (
                                <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
                                    {SECTIONS.map(s => {
                                        const isActive = activeTab === s.key;
                                        const count    = sectionCounts[s.key];
                                        return (
                                            <button key={s.key} className="df-tab" onClick={() => setTab(s.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700, border: isActive ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)', background: isActive ? 'linear-gradient(135deg,#9333ea,#ec4899)' : 'rgba(255,255,255,0.04)', color: isActive ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', boxShadow: isActive ? '0 3px 14px rgba(147,51,234,0.35)' : 'none' }}>
                                                {s.emoji} {s.label}
                                                {count > 0 && <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 999, fontSize: 10 }}>{count}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Goal list */}
                            {loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[1,2].map(i => <div key={i} style={{ height: 90, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />)}
                                </div>
                            ) : error ? (
                                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
                                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 14 }}>Failed to load your goals</p>
                                    <button onClick={loadGoals} style={{ padding: '8px 20px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>↻ Retry</button>
                                </div>
                            ) : !hasAnyGoals ? (
                                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                                    <div style={{ fontSize: 44, marginBottom: 12 }}>🌟</div>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>No goals yet</p>
                                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Create your first Dream Fund goal and let fans support you!</p>
                                </div>
                            ) : (
                                <GoalSection goals={sectionGoals} emptyMsg={
                                    activeTab === 'active'    ? 'No active goals. Create one and get it approved!' :
                                    activeTab === 'pending'   ? 'No goals pending review.' :
                                    activeTab === 'completed' ? 'No completed goals yet. Keep going!' :
                                    'No rejected goals.'
                                } />
                            )}

                            {/* Add goal CTA */}
                            {canCreate && (
                                <button
                                    onClick={() => setView('create')}
                                    style={{ width: '100%', height: 50, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#9333ea,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: hasAnyGoals ? 14 : 8, boxShadow: '0 4px 24px rgba(147,51,234,0.35)', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(147,51,234,0.5)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(147,51,234,0.35)'; }}
                                >
                                    ✦ Add Dream Fund Goal
                                </button>
                            )}
                        </>
                    )}

                    {/* ──────────── CREATE VIEW ─────────────────────────── */}
                    {view === 'create' && (
                        <CreateForm onBack={() => setView('tabs')} onSuccess={handleCreateSuccess} />
                    )}
                </div>
            </div>
        </>
    );
}
