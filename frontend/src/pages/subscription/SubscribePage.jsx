import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import subscriptionService from '../../services/subscriptionService';

// ── Pricing (display only — backend is authoritative) ─────────────────────────
const GST_RATE = 0.18;
const PLAN_DISCOUNTS = { 1: 0, 3: 10, 6: 20, 12: 30 };

function calcPlan(base, months) {
    const discPct    = PLAN_DISCOUNTS[months] ?? 0;
    const discounted = Math.round(base * months * (1 - discPct / 100) * 100) / 100;
    const original   = base * months;
    const savings    = Math.round((original - discounted) * 100) / 100;
    const gstAmt     = Math.round(discounted * GST_RATE * 100) / 100;
    const totalPaid  = Math.round(discounted * (1 + GST_RATE) * 100) / 100;
    const perMonth   = Math.round(discounted / months * 100) / 100;
    return { discPct, discounted, original, savings, gstAmt, totalPaid, perMonth };
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ months, base, selected, onSelect }) {
    const plan      = calcPlan(base, months);
    const isSelected = selected === months;
    const isBest     = months === 12;
    const isPop      = months === 3;
    const hasTop     = isBest || isPop;

    return (
        <button
            onClick={() => onSelect(months)}
            style={{
                position: 'relative',
                flex: '0 0 auto',
                width: 'calc(50% - 6px)',
                minWidth: 140,
                maxWidth: 180,
                borderRadius: 18,
                padding: hasTop ? '24px 14px 16px' : '16px 14px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: isSelected
                    ? 'linear-gradient(145deg,rgba(124,58,237,0.22),rgba(168,85,247,0.10))'
                    : 'rgba(255,255,255,0.05)',
                border: isSelected
                    ? '2px solid rgba(168,85,247,0.9)'
                    : isBest
                        ? '1.5px solid rgba(236,72,153,0.3)'
                        : '1.5px solid rgba(255,255,255,0.1)',
                boxShadow: isSelected
                    ? '0 0 28px rgba(168,85,247,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : 'none',
                transform: isSelected ? 'translateY(-3px) scale(1.02)' : 'none',
            }}
        >
            {/* Top badge */}
            {hasTop && (
                <div style={{
                    position: 'absolute', top: -11, left: '50%',
                    transform: 'translateX(-50%)',
                    background: isBest
                        ? 'linear-gradient(90deg,#ec4899,#a855f7)'
                        : 'linear-gradient(90deg,#7c3aed,#6d28d9)',
                    color: '#fff', fontSize: 9, fontWeight: 800,
                    padding: '3px 12px', borderRadius: 999,
                    whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase',
                    boxShadow: isBest ? '0 2px 12px rgba(236,72,153,0.5)' : '0 2px 12px rgba(124,58,237,0.5)',
                }}>
                    {isBest ? '🏆 Best Value' : '🔥 Popular'}
                </div>
            )}

            {/* Duration */}
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 8px', lineHeight: 1.2 }}>
                {months} {months === 1 ? 'month' : 'months'}
            </p>

            {/* Discount badge */}
            {plan.discPct > 0 ? (
                <div style={{
                    display: 'inline-block',
                    background: 'rgba(74,222,128,0.15)',
                    border: '1px solid rgba(74,222,128,0.35)',
                    color: '#4ade80', fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 6, marginBottom: 12,
                }}>
                    {plan.discPct}% off
                </div>
            ) : <div style={{ height: 22, marginBottom: 4 }} />}

            {/* Price */}
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: '0 0 2px', lineHeight: 1 }}>
                ₹{plan.totalPaid}
            </p>
            {plan.discPct > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'line-through', margin: '2px 0 4px' }}>
                    ₹{Math.round(plan.original * (1 + GST_RATE))}
                </p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11, margin: 0 }}>
                ₹{plan.perMonth}/mo incl. GST
            </p>

            {/* Selected check */}
            {isSelected && (
                <div style={{
                    position: 'absolute', bottom: 10, right: 10,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.5)',
                }}>
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="white">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                </div>
            )}
        </button>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscribePage() {
    const { username } = useParams();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [creator, setCreator]             = useState(null);
    const [loading, setLoading]             = useState(true);
    const [subscribing, setSubscribing]     = useState(false);
    const [error, setError]                 = useState('');
    const [alreadySubscribed, setAlreadySubscribed] = useState(false);
    const [selectedPlan, setSelectedPlan]   = useState(3);

    useEffect(() => {
        if (!authLoading && !isAuthenticated)
            navigate(`/register?redirect=${encodeURIComponent(`/creator/${username}/subscribe`)}`, { replace: true });
    }, [isAuthenticated, authLoading, navigate, username]);

    useEffect(() => {
        if (!username) return;
        setLoading(true);
        api.get(`/creator/profile/${username}`)
            .then(({ data }) => {
                setCreator(data.data);
                if (isAuthenticated && data.data) {
                    const id = data.data.userId || data.data._id;
                    subscriptionService.checkStatus(id)
                        .then(({ data: s }) => { if (s.data?.subscribed) setAlreadySubscribed(true); })
                        .catch(() => {});
                }
            })
            .catch(() => setError('Creator not found'))
            .finally(() => setLoading(false));
    }, [username, isAuthenticated]);

    const handleSubscribe = async () => {
        if (!creator || subscribing) return;
        setSubscribing(true); setError('');
        try {
            const creatorId = creator.userId || creator._id;
            const response  = await subscriptionService.createOrder(creatorId, selectedPlan);
            const orderData = response.data?.data;
            if (!orderData?.paymentSessionId) throw new Error('Invalid order response');

            sessionStorage.setItem('fannex_subscribe_return', window.location.pathname);
            if (!window.Cashfree) {
                await new Promise((res, rej) => {
                    const s = document.createElement('script');
                    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    s.onload = res; s.onerror = rej;
                    document.head.appendChild(s);
                });
            }
            window.Cashfree({ mode: orderData.cfMode || 'production' })
                  .checkout({ paymentSessionId: orderData.paymentSessionId, redirectTarget: '_self' });
        } catch (err) {
            if (err?.response?.status === 409 && err?.response?.data?.alreadySubscribed) {
                setAlreadySubscribed(true); setSubscribing(false); return;
            }
            setError(err?.response?.data?.message || err.message || 'Unable to initiate payment. Please try again.');
            setSubscribing(false);
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080510' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2.5px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error && !creator) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#080510' }}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
                <Link to="/explore" className="btn-brand" style={{ padding: '10px 24px', borderRadius: 12, textDecoration: 'none' }}>Browse Creators</Link>
            </div>
        </div>
    );

    if (!creator) return null;

    const base = creator.subscriptionPrice || 199;
    const plan = calcPlan(base, selectedPlan);

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0f0518 0%,#080510 60%,#050208 100%)', paddingBottom: 130 }}>

            {/* Ambient glow */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,0.13),transparent 70%)', filter: 'blur(60px)' }} />
                <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle,rgba(236,72,153,0.09),transparent 70%)', filter: 'blur(40px)' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 10, maxWidth: 460, margin: '0 auto', paddingTop: 12, paddingLeft: 14, paddingRight: 14 }}>

                {/* Back link */}
                <Link to={`/creator/${username}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', marginBottom: 14, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Back to profile
                </Link>

                {/* ── Main card ─────────────────────────────────────────────── */}
                <div style={{
                    borderRadius: 24,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                }}>

                    {/* ── Cover image ───────────────────────────────────────── */}
                    <div style={{ height: 180, position: 'relative', overflow: 'visible', background: 'linear-gradient(135deg,#3a0060,#1a0040)', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}>
                        {creator.coverImage ? (
                            <img src={creator.coverImage} alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${creator.coverImagePosition ?? 50}%`, display: 'block' }}/>
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #3a0060 0%, #7c3aed 50%, #ec4899 100%)' }} />
                        )}
                        {/* Gradient overlay at bottom */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 35%, rgba(8,5,16,0.85) 100%)' }} />

                        {/* Avatar — half-overlapping the cover */}
                        <div style={{ position: 'absolute', bottom: -46, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                            <div style={{
                                padding: 3, borderRadius: '50%',
                                background: 'linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)',
                                boxShadow: '0 4px 28px rgba(124,58,237,0.55)',
                            }}>
                                <div style={{ padding: 3, borderRadius: '50%', background: '#080510' }}>
                                    {creator.profileImage ? (
                                        <img src={creator.profileImage} alt={creator.displayName}
                                            style={{ width: 82, height: 82, borderRadius: '50%', objectFit: 'cover', objectPosition: `center ${creator.profileImagePosition ?? 50}%`, display: 'block' }}/>
                                    ) : (
                                        <div style={{ width: 82, height: 82, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: '#fff' }}>
                                            {creator.displayName?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Name + stats ─────────────────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, paddingBottom: 6 }}>

                        {/* Name */}
                        <div style={{ textAlign: 'center', marginTop: 12, paddingLeft: 20, paddingRight: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: '-0.025em' }}>{creator.displayName}</h1>
                                {creator.isVerified && (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#4ade80"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                                )}
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '3px 0 10px' }}>@{creator.username}</p>

                            {/* Stats — use actual API fields: totalPosts and totalSubscribers */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                                {[
                                    { label: 'posts', val: creator.totalPosts ?? 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
                                    { label: 'subscribers', val: creator.totalSubscribers ?? 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                                ].map((s, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.45)' }}>
                                            {s.icon}
                                            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{s.val}</span>
                                        </div>
                                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Inner content (padding) ───────────────────────────── */}
                    <div style={{ padding: '0 18px 24px' }}>

                        {alreadySubscribed ? (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                </div>
                                <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Already Subscribed!</p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>You have full access to this creator's content.</p>
                                <Link to={`/creator/${username}`} className="btn-brand" style={{ display: 'block', padding: '14px', borderRadius: 14, textAlign: 'center', textDecoration: 'none', fontWeight: 800, fontSize: 16 }}>
                                    View Content →
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* ── Perks ──────────────────────────────── */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 16, padding: '16px 18px', marginBottom: 22,
                                }}>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
                                        Don't miss out on full access to:
                                    </p>
                                    {[
                                        { emoji: '🔓', text: 'All exclusive subscriber-only content' },
                                        { emoji: '💬', text: 'Unlimited direct messaging' },
                                        { emoji: '✓',  text: 'Cancel at any time, risk free', green: true },
                                    ].map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                            <span style={{ fontSize: p.green ? 14 : 18, minWidth: 22, textAlign: 'center', color: p.green ? '#4ade80' : undefined, fontWeight: p.green ? 900 : undefined }}>
                                                {p.emoji}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.4 }}>{p.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Plan header ───────────────────────── */}
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                                    Choose your plan
                                </p>

                                {/* ── Plan grid — 2-column wrap ─────────── */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
                                    {[1, 3, 6, 12].map(m => (
                                        <PlanCard key={m} months={m} base={base} selected={selectedPlan} onSelect={setSelectedPlan} />
                                    ))}
                                </div>

                                {/* ── Payment summary ───────────────────── */}
                                <div style={{
                                    background: 'linear-gradient(145deg,rgba(124,58,237,0.1),rgba(124,58,237,0.04))',
                                    border: '1px solid rgba(124,58,237,0.22)',
                                    borderRadius: 18, padding: '18px 18px',
                                }}>
                                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                                        Payment Summary
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { label: `${selectedPlan}-month plan`, val: `₹${base} × ${selectedPlan}mo = ₹${Math.round(base * selectedPlan)}`, color: 'rgba(255,255,255,0.55)' },
                                            ...(plan.discPct > 0 ? [{ label: `Discount (${plan.discPct}% off)`, val: `− ₹${plan.savings}`, color: '#4ade80', labelColor: '#4ade80' }] : []),
                                            { label: 'Subtotal', val: `₹${plan.discounted}`, color: 'rgba(255,255,255,0.7)' },
                                            { label: 'GST (18%)', val: `+ ₹${plan.gstAmt}`, color: 'rgba(255,255,255,0.45)' },
                                        ].map((row, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: row.labelColor || 'rgba(255,255,255,0.45)', fontSize: 13.5 }}>{row.label}</span>
                                                <span style={{ color: row.color, fontWeight: 700, fontSize: 13.5 }}>{row.val}</span>
                                            </div>
                                        ))}

                                        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                                        {/* Total */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Total Payable</span>
                                            <div>
                                                <span style={{ color: '#c084fc', fontWeight: 900, fontSize: 22 }}>₹{plan.totalPaid}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 4 }}>incl. GST</span>
                                            </div>
                                        </div>

                                        {plan.savings > 0 && (
                                            <div style={{
                                                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.22)',
                                                borderRadius: 10, padding: '8px 14px', textAlign: 'center',
                                                color: '#4ade80', fontSize: 13, fontWeight: 700, marginTop: 4,
                                            }}>
                                                🎉 You save ₹{plan.savings} with this plan!
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {error && (
                                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', color: '#f87171', fontSize: 13, marginTop: 16 }}>
                                        {error}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fixed bottom CTA ─────────────────────────────────────────── */}
            {!alreadySubscribed && creator && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                    background: 'rgba(8,5,16,0.96)',
                    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    padding: '12px 18px env(safe-area-inset-bottom, 16px)',
                }}>
                    {/* Summary line */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, maxWidth: 460, margin: '0 auto 10px' }}>
                        <div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                {selectedPlan} month{selectedPlan > 1 ? 's' : ''}{plan.discPct > 0 ? ` · ${plan.discPct}% off` : ''}
                            </span>
                            {plan.savings > 0 && <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 8, fontWeight: 700 }}>Save ₹{plan.savings}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            {plan.discPct > 0 && (
                                <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, textDecoration: 'line-through' }}>
                                    ₹{Math.round(plan.original * (1 + GST_RATE))}
                                </span>
                            )}
                            <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>₹{plan.totalPaid}</span>
                        </div>
                    </div>

                    {/* Button */}
                    <div style={{ maxWidth: 460, margin: '0 auto' }}>
                        <button
                            onClick={handleSubscribe}
                            disabled={subscribing}
                            style={{
                                width: '100%', height: 56, borderRadius: 18, border: 'none',
                                background: subscribing
                                    ? 'rgba(124,58,237,0.45)'
                                    : 'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)',
                                color: '#fff', fontWeight: 900, fontSize: 18,
                                letterSpacing: '-0.025em', cursor: subscribing ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                boxShadow: '0 8px 32px rgba(124,58,237,0.45)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { if (!subscribing) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.6)'; }}}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(124,58,237,0.45)'; }}
                        >
                            {subscribing ? (
                                <><span style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Processing…</>
                            ) : (
                                <>⚡ Subscribe Now — ₹{plan.totalPaid}</>
                            )}
                        </button>
                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>
                            Secure payment via Cashfree · Cancel anytime
                        </p>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
