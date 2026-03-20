import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import dreamFundService from '../../services/dreamFundService';

// ── Confetti launcher ─────────────────────────────────────────────────────────
async function launchConfetti() {
    try {
        const { default: confetti } = await import('canvas-confetti');
        const duration = 3000;
        const end = Date.now() + duration;
        const colors = ['#9333ea', '#ec4899', '#f97316', '#facc15', '#4ade80'];
        (function frame() {
            confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
            confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    } catch (_) { /* canvas-confetti optional */ }
}

export default function DreamFundSuccess() {
    const [params] = useSearchParams();
    const orderId = params.get('order_id');

    const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'already' | 'error'
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!orderId) {
            setStatus('error');
            setError('No order ID found in URL.');
            return;
        }

        dreamFundService.verifyContribution({ orderId })
            .then((res) => {
                const payload = res.data;
                setData(payload.data);
                if (payload.alreadyRecorded) {
                    setStatus('already');
                } else {
                    setStatus('success');
                    if (payload.completed) launchConfetti();
                }
            })
            .catch((err) => {
                setError(err?.response?.data?.message || 'Verification failed. Please contact support.');
                setStatus('error');
            });
    }, [orderId]);

    const containerStyle = {
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,40,200,0.15), transparent), #050208',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '24px 16px',
    };

    const cardStyle = {
        background: 'linear-gradient(145deg, #1a0b2e 0%, #0d0718 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 28,
        padding: '40px 32px',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (status === 'verifying') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        border: '3px solid rgba(147,51,234,0.3)',
                        borderTopColor: '#9333ea',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 24px',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                        Verifying Your Contribution
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.44)', fontSize: 14 }}>
                        Please wait while we confirm your payment…
                    </p>
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────────
    if (status === 'error') {
        return (
            <div style={containerStyle}>
                <div style={{ ...cardStyle, border: '1px solid rgba(248,113,113,0.25)' }}>
                    <div style={{ fontSize: 52, marginBottom: 20 }}>❌</div>
                    <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 22, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                        Verification Failed
                    </h2>
                    <p style={{ color: 'rgba(248,113,113,0.8)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
                        {error}
                    </p>
                    <Link to="/explore"
                        style={{
                            display: 'block', width: '100%', padding: '14px',
                            background: 'linear-gradient(135deg, #9333ea, #ec4899)',
                            borderRadius: 16, color: '#fff', fontWeight: 800,
                            fontSize: 15, textDecoration: 'none', textAlign: 'center',
                        }}>
                        Explore Creators
                    </Link>
                </div>
            </div>
        );
    }

    // ── Already recorded ──────────────────────────────────────────────────────
    const pct = data ? Math.min(100, Math.round((data.currentAmount / data.targetAmount) * 100)) : 0;
    const isGoalCompleted = status === 'success' && data?.currentAmount >= data?.targetAmount;

    return (
        <div style={containerStyle}>
            <div style={{
                ...cardStyle,
                border: isGoalCompleted
                    ? '1px solid rgba(34,197,94,0.3)'
                    : '1px solid rgba(168,85,247,0.25)',
            }}>
                {/* Icon */}
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: isGoalCompleted
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(74,222,128,0.1))'
                        : 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(236,72,153,0.1))',
                    border: isGoalCompleted
                        ? '2px solid rgba(34,197,94,0.4)'
                        : '2px solid rgba(147,51,234,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, margin: '0 auto 24px',
                }}>
                    {isGoalCompleted ? '🎉' : status === 'already' ? '✅' : '💎'}
                </div>

                {/* Heading */}
                <h1 style={{
                    color: '#fff', fontWeight: 900, fontSize: 24,
                    margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1.2,
                }}>
                    {isGoalCompleted
                        ? 'Goal Achieved! 🎉'
                        : status === 'already'
                            ? 'Already Recorded!'
                            : 'Contribution Successful!'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
                    {isGoalCompleted
                        ? 'You helped this creator reach their dream! The admin will verify completion soon.'
                        : status === 'already'
                            ? 'Your contribution was already recorded. Thank you for your support!'
                            : 'Your contribution has been recorded. Thank you for supporting this creator!'}
                </p>

                {/* Progress bar */}
                {data && (
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16, padding: '18px 20px', marginBottom: 28,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Goal Progress</span>
                            <span style={{ color: '#a855f7', fontWeight: 800, fontSize: 13 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                            <div style={{
                                height: '100%', borderRadius: 999, width: `${pct}%`,
                                background: isGoalCompleted
                                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                    : 'linear-gradient(90deg, #9333ea, #ec4899)',
                                transition: 'width 1s ease',
                                boxShadow: isGoalCompleted ? '0 0 12px rgba(34,197,94,0.5)' : '0 0 10px rgba(168,85,247,0.4)',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            <span>₹{(data.currentAmount || 0).toLocaleString('en-IN')} raised</span>
                            <span>₹{(data.targetAmount || 0).toLocaleString('en-IN')} goal</span>
                        </div>
                    </div>
                )}

                {/* CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Link to="/explore"
                        style={{
                            display: 'block', padding: '14px',
                            background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 60%, #f97316 100%)',
                            borderRadius: 16, color: '#fff', fontWeight: 800,
                            fontSize: 15, textDecoration: 'none', textAlign: 'center',
                            transition: 'all 0.2s ease',
                        }}>
                        ✨ Explore More Creators
                    </Link>
                    <Link to="/"
                        style={{
                            display: 'block', padding: '14px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 16, color: 'rgba(255,255,255,0.7)', fontWeight: 700,
                            fontSize: 14, textDecoration: 'none', textAlign: 'center',
                        }}>
                        Back to Home
                    </Link>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 20 }}>
                    Order ID: {orderId}
                </p>
            </div>
        </div>
    );
}
