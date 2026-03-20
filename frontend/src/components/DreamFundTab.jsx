import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import dreamFundService from '../services/dreamFundService';
import ContributeModal from './ContributeModal';
import { useAuth } from '../context/AuthContext';

// ── Status-to-UI badge map ────────────────────────────────────────────────────
const STATUS_BADGE = {
    approved: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    completed: { label: 'Goal Achieved 🎉', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    awaiting_verification: { label: 'Awaiting Verification', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    verified: { label: '✓ Verified', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
};

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

// ── Confetti launcher ─────────────────────────────────────────────────────────
function launchConfetti() {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    const colors = ['#9333ea', '#ec4899', '#f97316', '#facc15', '#4ade80'];

    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}

// ── Single Goal Card ──────────────────────────────────────────────────────────
function GoalCard({ goal: initialGoal, onContribute }) {
    const [goal, setGoal] = useState(initialGoal);
    const [contributors, setContributors] = useState([]);
    const [feed, setFeed] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const completedFired = useRef(false);

    useEffect(() => { setGoal(initialGoal); }, [initialGoal]);

    // Fire confetti once when goal is completed
    useEffect(() => {
        if ((goal.status === 'completed' || goal.status === 'awaiting_verification' || goal.status === 'verified')
            && !completedFired.current) {
            completedFired.current = true;
            launchConfetti();
        }
    }, [goal.status]);

    useEffect(() => {
        if (!expanded) return;
        dreamFundService.getTopContributors(goal._id).then(r => setContributors(r.data.data)).catch(() => {});
        dreamFundService.getRecentContributions(goal._id).then(r => setFeed(r.data.data)).catch(() => {});
    }, [expanded, goal._id]);

    const pct = goal.progressPct ?? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const isCompleted = ['completed', 'awaiting_verification', 'verified'].includes(goal.status);
    const badge = STATUS_BADGE[goal.status];

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            overflow: 'hidden',
            marginBottom: 16,
            transition: 'border-color 0.2s ease',
        }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        >
            {/* Goal image */}
            {goal.image && (
                <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                    <img
                        src={goal.image}
                        alt={goal.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(13,7,24,0.9) 0%, transparent 60%)',
                    }} />
                    {badge && (
                        <div style={{
                            position: 'absolute', top: 12, right: 12,
                            background: badge.bg, border: `1px solid ${badge.color}40`,
                            color: badge.color, fontWeight: 700, fontSize: 11,
                            padding: '4px 10px', borderRadius: 999,
                            backdropFilter: 'blur(8px)',
                        }}>
                            {badge.label}
                        </div>
                    )}
                </div>
            )}

            <div style={{ padding: 20 }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                        {goal.title}
                    </h3>
                    {!goal.image && badge && (
                        <span style={{
                            background: badge.bg, border: `1px solid ${badge.color}40`,
                            color: badge.color, fontWeight: 700, fontSize: 11,
                            padding: '4px 10px', borderRadius: 999, flexShrink: 0,
                        }}>
                            {badge.label}
                        </span>
                    )}
                </div>

                {goal.description && (
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                        {goal.description}
                    </p>
                )}

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                            ₹{goal.currentAmount.toLocaleString('en-IN')}
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: 13 }}>
                                {' '}/ ₹{goal.targetAmount.toLocaleString('en-IN')}
                            </span>
                        </span>
                        <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 15 }}>{pct}%</span>
                    </div>

                    <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 999,
                            background: isCompleted
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : `linear-gradient(90deg, #9333ea ${pct < 50 ? '' : '0%,'} #ec4899, #f97316)`,
                            width: `${pct}%`,
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isCompleted ? '0 0 12px rgba(34,197,94,0.6)' : '0 0 12px rgba(168,85,247,0.5)',
                        }} />
                    </div>
                </div>

                {/* Supporters + urgency */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                        <span style={{ fontSize: 16 }}>❤️</span>
                        <span><strong style={{ color: '#fff' }}>{goal.supporterCount || 0}</strong> supporters</span>
                    </div>
                    {!isCompleted && remaining < goal.targetAmount * 0.2 && remaining > 0 && (
                        <span style={{
                            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                            color: '#f59e0b', fontWeight: 700, fontSize: 11,
                            padding: '4px 10px', borderRadius: 999,
                        }}>
                            🔥 ₹{remaining.toLocaleString('en-IN')} left!
                        </span>
                    )}
                </div>

                {/* Completion message */}
                {isCompleted && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(74,222,128,0.05))',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 12, padding: '12px 16px', marginBottom: 16,
                        color: '#4ade80', fontWeight: 700, fontSize: 14, textAlign: 'center',
                    }}>
                        🎉 Goal Achieved! Thank you to all supporters.
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                    {!isCompleted && (
                        <button
                            onClick={() => onContribute(goal)}
                            style={{
                                flex: 1, height: 46, borderRadius: 14, border: 'none',
                                background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 60%, #f97316 100%)',
                                color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em',
                                cursor: 'pointer', transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(168,85,247,0.4)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            💎 Contribute
                        </button>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            height: 46, padding: '0 14px', borderRadius: 14,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                            transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    >
                        {expanded ? '▲ Less' : '▼ More'}
                    </button>
                </div>

                {/* Expanded: top contributors + live feed */}
                {expanded && (
                    <div style={{ marginTop: 16 }}>
                        {/* Top contributors */}
                        {contributors.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    🏆 Top Supporters
                                </p>
                                {contributors.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                            background: c.profileImage ? 'none' : 'linear-gradient(135deg, #9333ea, #ec4899)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, color: '#fff', fontWeight: 800, overflow: 'hidden',
                                        }}>
                                            {c.profileImage
                                                ? <img src={c.profileImage} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : (c.name?.[0]?.toUpperCase() || '?')
                                            }
                                        </div>
                                        <span style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>
                                            {c.isAnonymous ? 'Anonymous' : c.name}
                                            {i === 0 && <span style={{ marginLeft: 6, fontSize: 12 }}>🥇</span>}
                                        </span>
                                        <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 13 }}>
                                            ₹{c.totalAmount.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Live feed */}
                        {feed.length > 0 && (
                            <div>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    🔴 Recent Contributions
                                </p>
                                {feed.map((f) => (
                                    <div key={f._id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                            background: f.user?.profileImage ? 'none' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 10, color: '#fff', fontWeight: 800, overflow: 'hidden',
                                        }}>
                                            {f.user?.profileImage
                                                ? <img src={f.user.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : (f.isAnonymous ? '?' : f.user?.name?.[0]?.toUpperCase() || '?')
                                            }
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>
                                                {f.isAnonymous ? 'Anonymous' : (f.user?.name || 'Fan')}
                                            </span>
                                            {f.message && (
                                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}> · {f.message}</span>
                                            )}
                                        </div>
                                        <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                            +₹{f.amount.toLocaleString('en-IN')}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, flexShrink: 0 }}>
                                            {timeAgo(f.createdAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function DreamFundTab({ creatorId, isOwnProfile, onOpenManager }) {
    const { isAuthenticated } = useAuth();
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [contributeGoal, setContributeGoal] = useState(null);

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
        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }
        setContributeGoal(goal);
    };

    const handleContributionSuccess = (result) => {
        setContributeGoal(null);
        // Optimistically update current amount + supporter count
        setGoals(prev => prev.map(g => {
            if (g._id !== contributeGoal?._id) return g;
            const newAmount = result.data?.currentAmount ?? g.currentAmount;
            const newStatus = result.completed ? 'completed' : g.status;
            return {
                ...g,
                currentAmount: newAmount,
                status: newStatus,
                progressPct: result.data?.progressPct ?? g.progressPct,
                supporterCount: (g.supporterCount || 0) + 1,
            };
        }));
        if (result.completed) launchConfetti();
    };

    if (loading) {
        return (
            <div style={{ padding: 20 }}>
                {[1, 2].map(i => (
                    <div key={i} style={{ height: 200, borderRadius: 20, background: 'rgba(255,255,255,0.04)', marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
            </div>
        );
    }

    if (goals.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🌟</div>
                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                    {isOwnProfile ? 'Share your dream with fans' : 'No Dream Funds yet'}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: isOwnProfile ? 24 : 0, maxWidth: 300, margin: '0 auto 24px' }}>
                    {isOwnProfile
                        ? 'Create a Dream Fund so your fans can help you achieve your goals.'
                        : 'This creator hasn\'t set up any Dream Funds yet.'}
                </p>
                {isOwnProfile && (
                    <button
                        onClick={onOpenManager}
                        style={{
                            padding: '12px 28px', borderRadius: 14, border: 'none',
                            background: 'linear-gradient(135deg, #9333ea, #ec4899)',
                            color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(168,85,247,0.4)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        + Create Dream Fund
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: '16px 0' }}>
            <style>{`@keyframes pulse { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '0 4px' }}>
                <div>
                    <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: 0, letterSpacing: '-0.03em' }}>
                        🌟 Dream Fund
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 0' }}>
                        Help this creator achieve their dreams
                    </p>
                </div>
                {isOwnProfile && (
                    <button
                        onClick={onOpenManager}
                        style={{
                            padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.4)',
                            background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168,85,247,0.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
                    >
                        ✏️ Manage
                    </button>
                )}
            </div>

            {/* Goal cards */}
            {goals.map(goal => (
                <GoalCard
                    key={goal._id}
                    goal={goal}
                    onContribute={handleContribute}
                />
            ))}

            {/* Contribution modal */}
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
