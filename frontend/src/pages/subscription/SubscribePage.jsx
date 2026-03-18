import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import subscriptionService from '../../services/subscriptionService';

// ── Pricing logic (display only — backend is authoritative) ──────────────────
const GST_RATE = 0.18;
const PLAN_DISCOUNTS = { 1: 0, 3: 10, 6: 20, 12: 30 };
const PLAN_LABELS    = { 1: 'Popular', 3: 'Popular', 6: 'Great Value', 12: 'Best Value' };
const PLAN_BADGE_HIGHLIGHT = { 3: true, 12: true };

function calcPlan(base, months) {
    const discPct   = PLAN_DISCOUNTS[months] ?? 0;
    const discFactor = 1 - discPct / 100;
    const discounted = Math.round(base * months * discFactor * 100) / 100;
    const original   = base * months;
    const savings    = Math.round((original - discounted) * 100) / 100;
    const gstAmt     = Math.round(discounted * GST_RATE * 100) / 100;
    const totalPaid  = Math.round(discounted * (1 + GST_RATE) * 100) / 100;
    const perMonth   = Math.round(discounted / months * 100) / 100;
    return { discPct, discounted, original, savings, gstAmt, totalPaid, perMonth };
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ months, base, selected, onSelect }) {
    const plan   = calcPlan(base, months);
    const label  = PLAN_LABELS[months];
    const isTop  = months === 12;
    const isPop  = months === 3;
    const isSelected = selected === months;

    return (
        <button
            onClick={() => onSelect(months)}
            style={{
                position: 'relative',
                flex: '0 0 auto',
                width: 148,
                minHeight: 172,
                borderRadius: 18,
                padding: '16px 14px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                background: isSelected
                    ? 'linear-gradient(145deg, rgba(124,58,237,0.18), rgba(168,85,247,0.08))'
                    : 'rgba(255,255,255,0.04)',
                border: isSelected
                    ? '2px solid rgba(168,85,247,0.8)'
                    : isTop
                        ? '2px solid rgba(236,72,153,0.35)'
                        : '2px solid rgba(255,255,255,0.1)',
                boxShadow: isSelected
                    ? '0 0 24px rgba(168,85,247,0.25)'
                    : isTop
                        ? '0 4px 20px rgba(236,72,153,0.12)'
                        : 'none',
                transform: isSelected ? 'translateY(-2px) scale(1.02)' : 'none',
            }}
        >
            {/* Top badge */}
            {(isTop || isPop) && (
                <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: isTop
                        ? 'linear-gradient(90deg, #ec4899, #a855f7)'
                        : 'linear-gradient(90deg, #7c3aed, #6d28d9)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    boxShadow: isTop ? '0 2px 12px rgba(236,72,153,0.4)' : '0 2px 12px rgba(124,58,237,0.4)',
                }}>
                    {isTop ? '🏆 Best Value' : '🔥 Popular'}
                </div>
            )}

            {/* Duration label */}
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 17, marginBottom: 6, lineHeight: 1.2 }}>
                {months} {months === 1 ? 'month' : 'months'}
            </p>

            {/* Discount badge */}
            {plan.discPct > 0 ? (
                <div style={{
                    display: 'inline-block',
                    background: 'rgba(74,222,128,0.15)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    color: '#4ade80',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    marginBottom: 10,
                }}>
                    {plan.discPct}% off
                </div>
            ) : (
                <div style={{ height: 20, marginBottom: 10 }} />
            )}

            {/* Price */}
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 18, marginBottom: 2, lineHeight: 1 }}>
                ₹{plan.totalPaid}
            </p>
            {plan.discPct > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textDecoration: 'line-through' }}>
                    ₹{Math.round(plan.original * (1 + GST_RATE))}
                </p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4 }}>
                ₹{plan.perMonth}/mo incl. GST
            </p>

            {/* Selected checkmark */}
            {isSelected && (
                <div style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="white">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </button>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubscribePage() {
    const { username } = useParams();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [creator, setCreator]                 = useState(null);
    const [loading, setLoading]                 = useState(true);
    const [subscribing, setSubscribing]         = useState(false);
    const [error, setError]                     = useState('');
    const [alreadySubscribed, setAlreadySubscribed] = useState(false);
    const [selectedPlan, setSelectedPlan]       = useState(3);   // default: 3-month
    const [showSummary, setShowSummary]         = useState(false);

    // Redirect unauthenticated users
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate(`/register?redirect=${encodeURIComponent(`/creator/${username}/subscribe`)}`, { replace: true });
        }
    }, [isAuthenticated, authLoading, navigate, username]);

    // Load creator profile
    useEffect(() => {
        if (!username) return;
        setLoading(true);
        api.get(`/creator/profile/${username}`)
            .then(({ data }) => {
                setCreator(data.data);
                if (isAuthenticated && data.data) {
                    const creatorId = data.data.userId || data.data._id;
                    subscriptionService.checkStatus(creatorId)
                        .then(({ data: s }) => { if (s.data?.subscribed) setAlreadySubscribed(true); })
                        .catch(() => {});
                }
            })
            .catch(() => setError('Creator not found'))
            .finally(() => setLoading(false));
    }, [username, isAuthenticated]);

    const handleConfirmSubscribe = async () => {
        if (!creator || subscribing) return;
        setSubscribing(true);
        setError('');
        try {
            const creatorId = creator.userId || creator._id;
            const response  = await subscriptionService.createOrder(creatorId, selectedPlan);
            const orderData = response.data?.data;

            if (!orderData?.paymentSessionId) throw new Error('Invalid order response from server');

            sessionStorage.setItem('fannex_subscribe_return', window.location.pathname);

            if (!window.Cashfree) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const cashfree = window.Cashfree({ mode: orderData.cfMode || 'production' });
            cashfree.checkout({ paymentSessionId: orderData.paymentSessionId, redirectTarget: '_self' });
        } catch (err) {
            if (err?.response?.status === 409 && err?.response?.data?.alreadySubscribed) {
                setAlreadySubscribed(true);
                setSubscribing(false);
                return;
            }
            setError(err?.response?.data?.message || err.message || 'Unable to initiate payment. Please try again.');
            setSubscribing(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
    );

    if (error && !creator) return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0f' }}>
            <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Link to="/explore" className="btn-brand px-6 py-2">Browse Creators</Link>
            </div>
        </div>
    );

    if (!creator) return null;

    const basePrice = creator.subscriptionPrice || 199;
    const plan      = calcPlan(basePrice, selectedPlan);
    const postCount = creator.postsCount ?? 0;
    const vidCount  = creator.videosCount ?? 0;

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg, #0f0515 0%, #0a0a0f 50%, #050208 100%)' }}>

            {/* ── Background glow ─────────────────────────────────────────── */}
            <div style={{ position: 'fixed', inset: 0, overflowHidden: true, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', left: '30%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%)', filter: 'blur(60px)' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08), transparent 70%)', filter: 'blur(40px)' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 10, maxWidth: 480, margin: '0 auto', paddingTop: 80, paddingBottom: 120, paddingLeft: 16, paddingRight: 16 }}>

                {/* ── Back arrow ──────────────────────────────────────────── */}
                <Link to={`/creator/${username}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none', marginBottom: 20, transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back to profile
                </Link>

                {/* ── Creator card ─────────────────────────────────────────── */}
                <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 24,
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                }}>

                    {/* Banner */}
                    <div style={{ height: 120, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg,#3a0060,#0d0020 55%,#1a0040)' }}>
                        {creator.coverImage && (
                            <img src={creator.coverImage} alt="" style={{
                                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                                objectPosition: `center ${creator.coverImagePosition ?? 50}%`
                            }} />
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75))' }} />
                    </div>

                    <div style={{ padding: '0 24px 24px' }}>

                        {/* Avatar — centered, overlapping banner */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -42, marginBottom: 12 }}>
                            <div style={{ padding: 3, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
                                {creator.profileImage ? (
                                    <img src={creator.profileImage} alt={creator.displayName}
                                        style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: `center ${creator.profileImagePosition ?? 50}%`, display: 'block' }} />
                                ) : (
                                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#fff' }}>
                                        {creator.displayName?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Name */}
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
                                <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: 0, letterSpacing: '-0.02em' }}>{creator.displayName}</h1>
                                {creator.isVerified && (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#4ade80"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                                )}
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>@{creator.username}</p>

                            {/* Posts/videos stats */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>{postCount}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700 }}>{vidCount}</span>
                                </div>
                            </div>
                        </div>

                        {alreadySubscribed ? (
                            /* Already subscribed */
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <svg className="w-7 h-7" style={{ color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Already Subscribed!</p>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>You already have full access to this creator's content.</p>
                                <Link to={`/creator/${username}`} className="btn-brand" style={{ display: 'block', padding: '12px', borderRadius: 14, textAlign: 'center', textDecoration: 'none', fontWeight: 700 }}>
                                    View Content →
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* ── Perks ────────────────────────────────────────── */}
                                <div style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 16,
                                    padding: '14px 16px',
                                    marginBottom: 24,
                                }}>
                                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Don't miss out on full access to:
                                    </p>
                                    {[
                                        { icon: '🔓', text: 'All exclusive subscriber-only content' },
                                        { icon: '💬', text: 'Unlimited direct messaging' },
                                        { icon: '✕',  text: 'Cancel at any time, risk free', sym: true },
                                    ].map((perk, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                                            <span style={{ fontSize: perk.sym ? 12 : 16, color: perk.sym ? '#4ade80' : undefined, fontWeight: perk.sym ? 900 : undefined }}>
                                                {perk.sym ? '✓' : perk.icon}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5 }}>{perk.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* ── Plan cards grid (horizontal scroll) ─────────── */}
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
                                    Choose your plan
                                </p>
                                <div style={{
                                    display: 'flex',
                                    gap: 10,
                                    overflowX: 'auto',
                                    paddingBottom: 8,
                                    marginLeft: -8,
                                    marginRight: -8,
                                    paddingLeft: 8,
                                    paddingRight: 8,
                                    scrollbarWidth: 'none',
                                }}>
                                    {[1, 3, 6, 12].map(months => (
                                        <PlanCard
                                            key={months}
                                            months={months}
                                            base={basePrice}
                                            selected={selectedPlan}
                                            onSelect={setSelectedPlan}
                                        />
                                    ))}
                                </div>

                                {/* ── Payment summary ───────────────────────────────── */}
                                <div style={{
                                    background: 'rgba(124,58,237,0.07)',
                                    border: '1px solid rgba(124,58,237,0.2)',
                                    borderRadius: 16,
                                    padding: '14px 16px',
                                    marginTop: 20,
                                }}>
                                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                        Payment Summary
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        {/* Subscription period */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                                                {selectedPlan}-month plan
                                            </span>
                                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                                                ₹{basePrice} × {selectedPlan}mo = ₹{Math.round(basePrice * selectedPlan)}
                                            </span>
                                        </div>

                                        {/* Discount */}
                                        {plan.discPct > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: '#4ade80', fontSize: 13 }}>
                                                    Discount ({plan.discPct}% off)
                                                </span>
                                                <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                                                    − ₹{plan.savings}
                                                </span>
                                            </div>
                                        )}

                                        {/* Discounted subtotal */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Subtotal</span>
                                            <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>₹{plan.discounted}</span>
                                        </div>

                                        {/* GST */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>GST (18%)</span>
                                            <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 13 }}>+ ₹{plan.gstAmt}</span>
                                        </div>

                                        {/* Divider */}
                                        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />

                                        {/* Total */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Total Payable</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ color: '#a78bfa', fontWeight: 900, fontSize: 20 }}>₹{plan.totalPaid}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginLeft: 4 }}>incl. GST</span>
                                            </div>
                                        </div>

                                        {/* You save banner */}
                                        {plan.savings > 0 && (
                                            <div style={{
                                                marginTop: 6,
                                                background: 'rgba(74,222,128,0.1)',
                                                border: '1px solid rgba(74,222,128,0.2)',
                                                borderRadius: 10,
                                                padding: '6px 12px',
                                                textAlign: 'center',
                                                fontSize: 12,
                                                color: '#4ade80',
                                                fontWeight: 700,
                                            }}>
                                                🎉 You save ₹{plan.savings} with this plan!
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Error */}
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

            {/* ── Fixed bottom CTA ──────────────────────────────────────────── */}
            {!alreadySubscribed && creator && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'rgba(5,2,8,0.95)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    padding: '14px 20px 20px',
                    maxWidth: 480,
                    margin: '0 auto',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                }}>
                    {/* Price preview line */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                {selectedPlan} month{selectedPlan > 1 ? 's' : ''} plan
                                {plan.discPct > 0 ? ` · ${plan.discPct}% off` : ''}
                            </span>
                            {plan.savings > 0 && (
                                <span style={{ color: '#4ade80', fontSize: 11, marginLeft: 8, fontWeight: 700 }}>
                                    Save ₹{plan.savings}
                                </span>
                            )}
                        </div>
                        <div>
                            {plan.discPct > 0 && (
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'line-through', marginRight: 6 }}>
                                    ₹{Math.round(plan.original * (1 + GST_RATE))}
                                </span>
                            )}
                            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>₹{plan.totalPaid}</span>
                        </div>
                    </div>

                    {/* CTA button */}
                    <button
                        onClick={handleConfirmSubscribe}
                        disabled={subscribing}
                        style={{
                            width: '100%',
                            height: 54,
                            borderRadius: 16,
                            border: 'none',
                            background: subscribing
                                ? 'rgba(124,58,237,0.5)'
                                : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 17,
                            letterSpacing: '-0.02em',
                            cursor: subscribing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            boxShadow: '0 8px 32px rgba(124,58,237,0.45)',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { if (!subscribing) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                        {subscribing ? (
                            <><span style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Processing…</>
                        ) : (
                            <>⚡ Subscribe Now — ₹{plan.totalPaid}</>
                        )}
                    </button>

                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>
                        Secure payment via Cashfree · Cancel anytime
                    </p>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
