import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import dreamFundService from '../services/dreamFundService';
import ContributeModal from './ContributeModal';
import { useAuth } from '../context/AuthContext';

// ── Image URL helper ──────────────────────────────────────────────────────────
const API_ORIGIN = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'https://api.fannex.in';

function getImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_ORIGIN}${url}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString('en-IN');
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_BADGE = {
    approved:              { label: 'Active',           color: '#22c55e', bg: 'rgba(34,197,94,0.14)',   glow: 'rgba(34,197,94,0.25)'    },
    completed:             { label: '🎯 Goal Reached',  color: '#f59e0b', bg: 'rgba(245,158,11,0.14)',  glow: 'rgba(245,158,11,0.25)'   },
    awaiting_verification: { label: 'Under Review',     color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  glow: 'rgba(96,165,250,0.2)'    },
    verified:              { label: '✓ Verified',        color: '#a855f7', bg: 'rgba(168,85,247,0.14)', glow: 'rgba(168,85,247,0.2)'    },
    paid:                  { label: '💸 Paid Out',       color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  glow: 'rgba(74,222,128,0.2)'    },
};

// ── Confetti ──────────────────────────────────────────────────────────────────
function launchConfetti() {
    const end = Date.now() + 3000;
    const colors = ['#9333ea', '#ec4899', '#f97316', '#facc15', '#4ade80'];
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, completed }) {
    return (
        <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
            <div style={{
                height: '100%', borderRadius: 999,
                width: `${clamp(pct, 0, 100)}%`,
                background: completed
                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : 'linear-gradient(90deg, #9333ea, #ec4899, #f97316)',
                boxShadow: completed ? '0 0 12px rgba(34,197,94,0.55)' : '0 0 10px rgba(168,85,247,0.4)',
                transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            }} />
        </div>
    );
}

// ── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 28 }) {
    const [err, setErr] = useState(false);
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#9333ea,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.4 }}>
            {src && !err ? <img src={getImageUrl(src)} alt={name} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((name || '?').charAt(0).toUpperCase())}
        </div>
    );
}

// ── Single Goal Card ──────────────────────────────────────────────────────────
function GoalCard({ goal: initialGoal, onContribute, isSubscribed, isOwnProfile, hasContributed }) {
    const [goal, setGoal] = useState(initialGoal);
    const [contributors, setContributors] = useState([]);
    const [feed, setFeed] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [imgErr, setImgErr] = useState(false);
    const completedFired = useRef(false);

    useEffect(() => { setGoal(initialGoal); }, [initialGoal]);

    // Viewer eligibility for celebration content
    const canSeeCelebration = isSubscribed || isOwnProfile || hasContributed;

    // Load contributors + feed inline (no expand button)
    useEffect(() => {
        if (goal.supporterCount < 1) return;
        setLoadingDetails(true);
        Promise.all([
            dreamFundService.getTopContributors(goal._id).catch(() => ({ data: { data: [] } })),
            dreamFundService.getRecentContributions(goal._id).catch(() => ({ data: { data: [] } })),
        ]).then(([topRes, feedRes]) => {
            setContributors(topRes.data.data || []);
            setFeed(feedRes.data.data || []);
        }).finally(() => setLoadingDetails(false));
    // Only run once per goal
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goal._id, goal.supporterCount]);

    // Confetti — only for eligible viewers
    useEffect(() => {
        const celebStatus = ['completed', 'awaiting_verification', 'verified', 'paid'];
        if (canSeeCelebration && celebStatus.includes(goal.status) && !completedFired.current) {
            completedFired.current = true;
            launchConfetti();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goal.status, canSeeCelebration]);

    const pct = goal.progressPct ?? clamp(Math.round((goal.currentAmount / goal.targetAmount) * 100), 0, 100);
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const isCompleted = ['completed', 'awaiting_verification', 'verified', 'paid'].includes(goal.status);
    const badge = STATUS_BADGE[goal.status];
    const goalImageUrl = !imgErr ? getImageUrl(goal.image) : null;

    return (
        <article style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: `1px solid ${isCompleted ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 22, overflow: 'hidden',
            transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: isCompleted ? '0 4px 32px rgba(168,85,247,0.08)' : 'none',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.35)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(168,85,247,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = isCompleted ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = isCompleted ? '0 4px 32px rgba(168,85,247,0.08)' : 'none'; }}
        >
            {/* ── Banner image ─────────────────────────────── */}
            {goalImageUrl && (
                <div style={{ position: 'relative', height: 0, paddingBottom: '52%', overflow: 'hidden' }}>
                    <img
                        src={goalImageUrl} alt={goal.title} loading="lazy"
                        onError={() => setImgErr(true)}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                    />
                    {/* Gradient overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,4,16,0.97) 0%, rgba(8,4,16,0.3) 55%, transparent 100%)' }} />
                    {/* Status badge */}
                    {badge && (
                        <div style={{ position: 'absolute', top: 12, right: 12, background: badge.bg, border: `1px solid ${badge.color}40`, color: badge.color, fontWeight: 700, fontSize: 11, padding: '5px 12px', borderRadius: 999, backdropFilter: 'blur(12px)', letterSpacing: '0.02em', boxShadow: `0 0 12px ${badge.glow}` }}>
                            {badge.label}
                        </div>
                    )}
                </div>
            )}

            <div style={{ padding: 'clamp(14px,4vw,20px)' }}>
                {/* Status badge (no image) + title */}
                <div style={{ marginBottom: 12 }}>
                    {!goalImageUrl && badge && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 999, background: badge.bg, border: `1px solid ${badge.color}40`, color: badge.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', marginBottom: 8, boxShadow: `0 0 10px ${badge.glow}` }}>
                            {badge.label}
                        </div>
                    )}
                    <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(16px,4vw,20px)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.25 }}>
                        {goal.title}
                    </h3>
                    {goal.description && (
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '7px 0 0', lineHeight: 1.65 }}>
                            {goal.description}
                        </p>
                    )}
                </div>

                {/* ── Amounts + progress ─────────────────── */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                            <span style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(14px,3.5vw,17px)', letterSpacing: '-0.02em' }}>₹{fmt(goal.currentAmount)}</span>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 500, fontSize: 13 }}> / ₹{fmt(goal.targetAmount)}</span>
                        </div>
                        <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em', background: isCompleted ? 'linear-gradient(135deg,#22c55e,#4ade80)' : 'linear-gradient(135deg,#9333ea,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {pct}%
                        </span>
                    </div>
                    <ProgressBar pct={pct} completed={isCompleted} />
                </div>

                {/* ── Supporter count + urgency ──────────── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 15 }}>❤️</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                            <strong style={{ color: '#fff', fontWeight: 700 }}>{goal.supporterCount || 0}</strong> {goal.supporterCount === 1 ? 'supporter' : 'supporters'}
                        </span>
                    </div>
                    {/* Near-completion urgency pill */}
                    {!isCompleted && remaining > 0 && remaining < goal.targetAmount * 0.25 && (
                        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>
                            🔥 ₹{fmt(remaining)} to go!
                        </div>
                    )}
                </div>

                {/* ── Goal Achieved banner ────────────────── */}
                {isCompleted && canSeeCelebration && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(34,197,94,0.09), rgba(74,222,128,0.04))', border: '1px solid rgba(34,197,94,0.22)', marginBottom: 14, boxShadow: '0 0 18px rgba(34,197,94,0.07)' }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>🎉</span>
                        <div>
                            <p style={{ color: '#4ade80', fontWeight: 800, fontSize: 14, margin: 0, letterSpacing: '-0.01em' }}>Goal Achieved!</p>
                            <p style={{ color: 'rgba(74,222,128,0.6)', fontSize: 11, margin: '2px 0 0' }}>Thank you to all {goal.supporterCount || 0} supporters.</p>
                        </div>
                    </div>
                )}

                {/* ── Contribute button / completed state ── */}
                {!isCompleted ? (
                    <button
                        onClick={() => onContribute(goal)}
                        style={{ width: '100%', height: 50, borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#9333ea,#ec4899,#f97316)', color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(168,85,247,0.45)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        💎 Contribute
                    </button>
                ) : (
                    <div style={{ width: '100%', height: 50, borderRadius: 16, background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(74,222,128,0.04))', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>✅</span>
                        <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Goal Funded</span>
                    </div>
                )}

                {/* ── Top contributors — inline, no expand ─ */}
                {contributors.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 10px' }}>🏆 Top Supporters</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {contributors.slice(0, 3).map((c, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Avatar src={c.profileImage} name={c.name} size={30} />
                                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>
                                        {c.isAnonymous ? 'Anonymous' : c.name}
                                        {i === 0 && <span style={{ marginLeft: 5, fontSize: 13 }}>🥇</span>}
                                    </span>
                                    <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 13 }}>₹{fmt(c.totalAmount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Recent feed — inline ────────────────── */}
                {feed.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 8px' }}>🔴 Recent</p>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {feed.slice(0, 5).map(f => (
                                <div key={f._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Avatar src={f.user?.profileImage} name={f.isAnonymous ? '?' : f.user?.name} size={24} />
                                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, minWidth: 0 }}>
                                        {f.isAnonymous ? 'Anonymous' : (f.user?.name || 'Fan')}
                                        {f.message && <span style={{ color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}> · {f.message.length > 30 ? f.message.slice(0, 30) + '…' : f.message}</span>}
                                    </span>
                                    <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>+₹{fmt(f.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Skeleton while details loading */}
                {loadingDetails && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[1,2].map(i => <div key={i} style={{ height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', animation: 'dfPulse 1.5s ease-in-out infinite' }} />)}
                    </div>
                )}
            </div>
        </article>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function DreamFundTab({ creatorId, isOwnProfile, isSubscribed, onOpenManager }) {
    const { isAuthenticated } = useAuth();
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contributeGoal, setContributeGoal] = useState(null);
    const [contributedGoalIds, setContributedGoalIds] = useState(() => new Set());

    const loadGoals = useCallback(() => {
        if (!creatorId) return;
        setLoading(true);
        dreamFundService.getCreatorGoals(creatorId)
            .then(r => setGoals(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [creatorId]);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const handleContribute = (goal) => {
        if (!isAuthenticated) { window.location.href = '/login'; return; }
        setContributeGoal(goal);
    };

    const handleContributionSuccess = (result) => {
        const goalId = contributeGoal?._id;
        setContributeGoal(null);
        if (goalId) setContributedGoalIds(prev => new Set([...prev, goalId.toString()]));
        setGoals(prev => prev.map(g => {
            if (g._id !== goalId) return g;
            return {
                ...g,
                currentAmount: result.data?.currentAmount ?? g.currentAmount,
                status: result.completed ? 'completed' : g.status,
                progressPct: result.data?.progressPct ?? g.progressPct,
                supporterCount: (g.supporterCount || 0) + 1,
            };
        }));
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ padding: '12px 0' }}>
            <style>{`@keyframes dfPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }`}</style>
            {[220, 180].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 22, background: 'rgba(255,255,255,0.04)', marginBottom: 16, animation: 'dfPulse 1.6s ease-in-out infinite' }} />
            ))}
        </div>
    );

    // ── Empty state ───────────────────────────────────────────────────────────
    if (goals.length === 0) return (
        <div style={{ textAlign: 'center', padding: '52px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🌟</div>
            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                {isOwnProfile ? 'Share your dream with fans' : 'No Dream Funds yet'}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, margin: '0 auto 24px', maxWidth: 280, lineHeight: 1.6 }}>
                {isOwnProfile ? 'Create a goal and let your fans help you achieve it.' : 'This creator hasn\'t set up any Dream Funds yet.'}
            </p>
            {isOwnProfile && (
                <button
                    onClick={onOpenManager}
                    style={{ padding: '13px 30px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#9333ea,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 6px 24px rgba(147,51,234,0.4)', transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(147,51,234,0.5)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 24px rgba(147,51,234,0.4)'; }}
                >
                    ✦ Create Dream Fund
                </button>
            )}
        </div>
    );

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '16px 0' }}>
            <style>{`@keyframes dfPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '0 4px' }}>
                <div>
                    <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(18px,4vw,22px)', margin: 0, letterSpacing: '-0.03em' }}>🌟 Dream Fund</h2>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '4px 0 0' }}>Help this creator achieve their dreams</p>
                </div>
                {isOwnProfile && (
                    <button
                        onClick={onOpenManager}
                        style={{ padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
                    >
                        ✏️ Manage
                    </button>
                )}
            </div>

            {/* Goal Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {goals.map(goal => (
                    <GoalCard
                        key={goal._id}
                        goal={goal}
                        onContribute={handleContribute}
                        isSubscribed={isSubscribed}
                        isOwnProfile={isOwnProfile}
                        hasContributed={contributedGoalIds.has(goal._id?.toString())}
                    />
                ))}
            </div>

            {/* Contribute Modal */}
            {contributeGoal && (
                <ContributeModal
                    goal={contributeGoal}
                    onClose={() => setContributeGoal(null)}
                    onSuccess={handleContributionSuccess}
                />
            )}
        </div>
    );
}
