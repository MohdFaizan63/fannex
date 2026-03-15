import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import chatService from '../../services/chatService';

export default function SubscriptionSuccess() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const cfOrderId = searchParams.get('order_id');

    const [verifying, setVerifying] = useState(!!cfOrderId);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);

    const [orderType, setOrderType] = useState('subscription');
    const [creator, setCreator] = useState(null);
    const [chatId, setChatId] = useState(null);
    const [redirecting, setRedirecting] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);
    const [walletAmount, setWalletAmount] = useState(null);
    const [sourceChatId, setSourceChatId] = useState(null);
    const [giftAmount, setGiftAmount] = useState(null);
    const timerRef = useRef(null);
    // verifiedRef prevents the cfOrderId=null guard from firing after
    // setSearchParams clears the query string (component does NOT remount,
    // but the effect re-runs because cfOrderId enters the dependency array).
    const verifiedRef = useRef(false);

    // ── Back-navigation guard (5-entry) ──────────────────────────────────────
    // ROOT CAUSE of the bug: setSearchParams({}, { replace:true }) calls
    // history.replaceState() internally, which OVERWRITES our single guard entry.
    // After verify+cleanup runs, history = [...cashfree, /subscription-success]
    // and pressing Back goes straight to Cashfree.
    //
    // Fix: push 5 guard entries. setSearchParams only replaces entry #5.
    // Entries #1-#4 absorb Back presses → popstate fires → redirect home.
    useEffect(() => {
        const cleanPath = window.location.pathname;
        for (let i = 0; i < 5; i++) {
            window.history.pushState({ paymentGuard: true, i }, '', cleanPath);
        }
        const handleBack = () => { window.location.replace('/'); };
        window.addEventListener('popstate', handleBack);
        return () => window.removeEventListener('popstate', handleBack);
    }, []); // mount-only — must run before verify effect
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        // No order_id in URL.
        // Guard: if we already verified (verifiedRef=true) this means setSearchParams
        // just cleaned the URL — do NOT redirect, the success UI is already showing.
        if (!cfOrderId) {
            if (verifiedRef.current) return; // ← success page is rendering, stay put
            const cached = sessionStorage.getItem('fannex_sub_success');
            if (cached) {
                try {
                    const d = JSON.parse(cached);
                    if (d.creator?.username) {
                        navigate(`/creator/${d.creator.username}`, { replace: true, state: { subscribed: true } });
                    } else {
                        navigate('/explore', { replace: true });
                    }
                } catch { navigate('/explore', { replace: true }); }
            } else {
                navigate('/explore', { replace: true });
            }
            return;
        }

        const verify = async () => {
            try {
                const { data } = await api.post('/payment/verify', { orderId: cfOrderId, creatorId: null });
                if (!data.success) {
                    setError('Payment could not be verified. Please contact support@fannex.in');
                    return;
                }

                const type = data.type || 'subscription';
                setVerified(true);
                verifiedRef.current = true; // guard against cfOrderId=null redirect after URL clean
                setOrderType(type);

                if (type === 'wallet') {
                    // ── Wallet recharge ──────────────────────────────────────────
                    setWalletBalance(data.walletBalance);
                    setWalletAmount(data.amount);
                    // Clean the URL without navigating away (navigate() would trigger
                    // cfOrderId=null guard and redirect to /explore)
                    setSearchParams({}, { replace: true });

                } else if (type === 'chat_unlock') {
                    // ── Chat unlock: auto-redirect to chat ───────────────────────
                    setChatId(data.chatId || null);
                    if (data.chatId) {
                        setRedirecting(true);
                        timerRef.current = setTimeout(() => navigate(`/chat/${data.chatId}`, { replace: true }), 2000);
                    }

                } else if (type === 'gift') {
                    // ── Gift payment ─────────────────────────────────────────────
                    if (data.creator) setCreator(data.creator);
                    if (data.amount) setGiftAmount(data.amount);

                    // Call /chat/gift/verify to persist the gift message bubble
                    const stored = sessionStorage.getItem('fannex_gift_chat');
                    if (stored) {
                        try {
                            const { chatId: giftChatId, amount } = JSON.parse(stored);
                            setSourceChatId(giftChatId);
                            await chatService.verifyGift({
                                orderId: cfOrderId,
                                chatId: giftChatId,
                                amount,
                            });
                            sessionStorage.removeItem('fannex_gift_chat');
                        } catch (_) {
                            // verifyGift failure is non-fatal — webhook may have already processed it
                        }
                    }
                    // Clean the URL without navigating away — CRITICAL: navigate() would
                    // set cfOrderId=null and redirect to /explore before the UI renders.
                    setSearchParams({}, { replace: true });

                } else {
                    // ── Subscription (default) ───────────────────────────────────
                    setChatId(data.chatId || null);
                    if (data.creator) {
                        setCreator(data.creator);
                        sessionStorage.setItem('fannex_sub_success', JSON.stringify({
                            orderType: type,
                            creator: data.creator,
                            chatId: data.chatId || null,
                        }));
                    }
                    // Clean URL without navigating away
                    setSearchParams({}, { replace: true });
                }

                // First attempt succeeded — hide the spinner
                setVerifying(false);
                refreshUser().catch(() => { });
                return;

            } catch (err) {
                // ── Smart failure handling ───────────────────────────────────────
                // The verify endpoint can throw on transient server errors (5xx),
                // even when the payment was actually captured by Cashfree.
                // Strategy:
                //   1. Wait 3s and retry verify once.
                //   2. If retry also fails, check /payment/status/:orderId to
                //      see if the payment was already processed (webhook may have
                //      handled it). If it was, show success; otherwise go to /payment-failed.

                const retry = async () => {
                    try {
                        const { data } = await api.post('/payment/verify', { orderId: cfOrderId, creatorId: null });
                        if (data.success) {
                            const type = data.type || 'subscription';
                            setVerified(true);
                            verifiedRef.current = true;
                            setOrderType(type);
                            if (type === 'wallet') {
                                setWalletBalance(data.walletBalance);
                                setWalletAmount(data.amount);
                            } else {
                                if (data.creator) {
                                    setCreator(data.creator);
                                    sessionStorage.setItem('fannex_sub_success', JSON.stringify({
                                        orderType: type,
                                        creator: data.creator,
                                        chatId: data.chatId || null,
                                    }));
                                }
                                if (data.chatId) setChatId(data.chatId);
                            }
                            setSearchParams({}, { replace: true });
                            setVerifying(false);
                            refreshUser().catch(() => { });
                            return; // success on retry — done
                        }
                    } catch (_) {
                        // retry also failed — fall through to /payment/status check
                    }

                    // Last resort: check if payment was already marked captured in our DB
                    try {
                        const { data: statusData } = await api.get(`/payment/status/${cfOrderId}`);
                        if (statusData?.status === 'captured') {
                            // Payment was processed (probably by webhook) — show a generic success
                            setVerified(true);
                            verifiedRef.current = true;
                            setOrderType(statusData.type || 'subscription');
                            setSearchParams({}, { replace: true });
                            setVerifying(false);
                            refreshUser().catch(() => { });
                            return;
                        }
                    } catch (_) { /* ignore — we tried */ }

                    // Truly failed — redirect to failure page
                    setVerifying(false);
                    navigate('/payment-failed', { replace: true });
                };

                // Keep the spinner showing while we wait to retry (don't call setVerifying(false) yet)
                // Wait 3s then retry — gives server time to recover from a cold restart
                timerRef.current = setTimeout(retry, 3000);
            }
        };
        verify();
        return () => clearTimeout(timerRef.current);
    }, [cfOrderId, navigate, refreshUser]);


    /* ── Loading ─────────────────────────────────────────────────────────────── */
    if (verifying) {
        return (
            <div style={pageStyle}>
                <div style={{ textAlign: 'center' }}>
                    <div style={spinnerStyle} />
                    <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 16, fontSize: 15 }}>Verifying your payment…</p>
                </div>
                <style>{globalKeyframes}</style>
            </div>
        );
    }

    /* ── Error ───────────────────────────────────────────────────────────────── */
    if (error) {
        return (
            <div style={pageStyle}>
                <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 16px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <p style={{ color: '#f87171', marginBottom: 20, lineHeight: 1.6 }}>{error}</p>
                    <Link to="/explore" style={btnPrimary}>Explore Creators</Link>
                </div>
                <style>{globalKeyframes}</style>
            </div>
        );
    }

    /* ── Wallet Recharge Success ──────────────────────────────────────────────── */
    if (orderType === 'wallet') {
        return (
            <div style={pageStyle}>
                <Orbs colors={['#7c3aed', '#10b981']} />
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed, #10b981)',
                        boxShadow: '0 8px 28px rgba(124,58,237,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 32, margin: '0 auto 18px',
                    }}>💳</div>
                    <h1 style={headingStyle}>Wallet Recharged! 🎉</h1>
                    <p style={subtitleStyle}>Your wallet has been topped up successfully.</p>
                    {walletAmount && (
                        <div style={{
                            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                            borderRadius: 14, padding: '12px 20px', marginBottom: 16,
                            display: 'inline-block',
                        }}>
                            <span style={{ color: '#a78bfa', fontWeight: 900, fontSize: 22 }}>
                                +₹{Number(walletAmount).toLocaleString('en-IN')} Added
                            </span>
                        </div>
                    )}
                    {walletBalance !== null && (
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>
                            New balance: <strong style={{ color: '#fff' }}>₹{Math.round(walletBalance)}</strong>
                        </p>
                    )}
                    <Link to="/wallet" style={btnPrimary}>Go to Wallet</Link>
                </div>
                <style>{globalKeyframes}</style>
            </div>
        );
    }

    /* ── Chat-Unlock redirect screen ─────────────────────────────────────────── */
    if (orderType === 'chat_unlock') {
        return (
            <div style={pageStyle}>
                <Orbs colors={['#7c3aed', '#cc52b8']} />
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                    <div style={{ fontSize: 56, marginBottom: 18 }}>💬</div>
                    <h1 style={headingStyle}>Chat Unlocked! 🎉</h1>
                    <p style={subtitleStyle}>You can now chat privately with the creator.</p>
                    {redirecting ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 24 }}>
                            <div style={{ ...spinnerStyle, borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }} />
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Opening your chat…</p>
                        </div>
                    ) : chatId && (
                        <Link to={`/chat/${chatId}`} style={{ ...btnPrimary, marginTop: 24 }}>Open Chat</Link>
                    )}
                </div>
                <style>{globalKeyframes}</style>
            </div>
        );
    }

    /* ── Gift Success screen ───────────────────────────────────────────────────── */
    if (orderType === 'gift') {
        const giftCreatorName = creator?.name || 'the creator';
        const giftCreatorUsername = creator?.username;
        const giftProfileImage = creator?.profileImage;
        const displayGiftAmount = giftAmount ?? null;

        return (
            <div style={{ ...pageStyle, justifyContent: 'center' }}>
                <Orbs colors={['#ff7a18', '#ffb347']} />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 16px' }}>

                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div style={{
                                position: 'absolute', inset: -14, borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(255,122,24,0.25), transparent 70%)',
                                animation: 'pulse 2s ease-in-out infinite',
                            }} />
                            <div style={{
                                width: 96, height: 96, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                boxShadow: '0 12px 40px rgba(255,122,24,0.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 44, position: 'relative',
                            }}>🎁</div>
                        </div>
                    </div>

                    <div style={{
                        background: 'linear-gradient(160deg, #0e0e1e, #130a00)',
                        border: '1px solid rgba(255,122,24,0.2)', borderRadius: 28,
                        padding: '28px 24px 24px', textAlign: 'center',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                    }}>
                        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 24, margin: '0 0 6px' }}>
                            Gift Sent! 🎉
                        </h1>
                        <p style={{ color: 'rgba(255,180,71,0.7)', fontSize: 14, margin: '0 0 22px', lineHeight: 1.6 }}>
                            Your heartfelt gift is on its way to someone special
                        </p>

                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,122,24,0.15)',
                            borderRadius: 18, padding: '14px 16px', marginBottom: 18,
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                                border: '2px solid rgba(255,122,24,0.4)',
                                background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                            }}>
                                {giftProfileImage
                                    ? <img src={giftProfileImage} alt={giftCreatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{giftCreatorName[0]?.toUpperCase()}</span>
                                }
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>To {giftCreatorName}</p>
                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0 }}>Your favorite creator</p>
                            </div>
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255,122,24,0.2), rgba(255,179,71,0.15))',
                                border: '1px solid rgba(255,122,24,0.35)', borderRadius: 12, padding: '6px 14px',
                                color: '#ffb347', fontWeight: 900, fontSize: 16, flexShrink: 0,
                            }}>
                                {displayGiftAmount ? `₹${Number(displayGiftAmount).toLocaleString('en-IN')}` : '🎁'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {sourceChatId && (
                                <Link to={`/chat/${sourceChatId}?refresh=1`} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    padding: '14px 0', borderRadius: 999,
                                    background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                    boxShadow: '0 6px 20px rgba(255,122,24,0.4)',
                                    color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
                                }}>
                                    <span>💬</span> Back to Chat
                                </Link>
                            )}
                            {!sourceChatId && giftCreatorUsername && (
                                <Link to={`/creator/${giftCreatorUsername}`} style={{
                                    display: 'block', textAlign: 'center', padding: '14px 0', borderRadius: 999,
                                    background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                    boxShadow: '0 6px 20px rgba(255,122,24,0.4)',
                                    color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
                                }}>
                                    Visit {giftCreatorName}'s Profile
                                </Link>
                            )}
                            {sourceChatId && giftCreatorUsername && (
                                <Link to={`/creator/${giftCreatorUsername}`} style={{
                                    display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 16,
                                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, textDecoration: 'none',
                                }}>
                                    View {giftCreatorName}'s Profile
                                </Link>
                            )}
                            <Link to="/explore" style={{
                                display: 'block', textAlign: 'center', padding: '12px 0',
                                color: 'rgba(255,255,255,0.35)', fontSize: 14, textDecoration: 'none',
                            }}>
                                Explore more creators →
                            </Link>
                        </div>
                    </div>
                </div>
                <style>{globalKeyframes}</style>
            </div>
        );
    }

    /* ──────────────────────────────────────────────────────────────────────────── */
    /* ── SUBSCRIPTION SUCCESS — Premium Redesign                              ── */
    /* ──────────────────────────────────────────────────────────────────────────── */
    const creatorName = creator?.name || 'the creator';
    const creatorUsername = creator?.username;
    const profileImage = creator?.profileImage;

    return (
        <div style={pageStyle}>
            {/* Decorative orbs */}
            <Orbs colors={['#7c3aed', '#a855f7']} />

            {/* Subtle top glow */}
            <div style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: '100%', maxWidth: 600, height: 260,
                background: 'radial-gradient(ellipse at top, rgba(124,58,237,0.18) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                    position: 'relative', zIndex: 1,
                    width: '100%', maxWidth: 420,
                    padding: '0 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
            >
                {/* ── Animated check icon ─────────────────────────────────────── */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', damping: 12, stiffness: 260 }}
                    style={{
                        width: 88, height: 88, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #cc52b8 100%)',
                        boxShadow: '0 16px 48px rgba(124,58,237,0.5), 0 0 0 6px rgba(124,58,237,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 28, position: 'relative',
                    }}
                >
                    {/* Pulse ring behind */}
                    <div style={{
                        position: 'absolute', inset: -12,
                        borderRadius: '50%', opacity: 0.3,
                        border: '2px solid rgba(168,85,247,0.5)',
                        animation: 'pulseRing 2s ease-in-out infinite',
                    }} />
                    {profileImage ? (
                        <img
                            src={profileImage}
                            alt={creatorName}
                            style={{
                                width: 78, height: 78, borderRadius: '50%',
                                objectFit: 'cover', border: '3px solid rgba(255,255,255,0.15)',
                            }}
                        />
                    ) : (
                        <span style={{
                            color: '#fff', fontWeight: 900,
                            fontSize: 'clamp(28px, 6vw, 36px)',
                        }}>
                            {creatorName[0]?.toUpperCase()}
                        </span>
                    )}
                </motion.div>

                {/* ── Title ───────────────────────────────────────────────── */}
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{
                        color: '#fff', fontWeight: 900,
                        fontSize: 'clamp(22px, 5.5vw, 28px)',
                        margin: '0 0 8px', textAlign: 'center',
                        letterSpacing: '-0.5px', lineHeight: 1.15,
                    }}
                >
                    You're Subscribed!
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 'clamp(14px, 3.5vw, 16px)',
                        margin: '0 0 28px', textAlign: 'center',
                        lineHeight: 1.5,
                    }}
                >
                    You now have full access to{' '}
                    <strong style={{ color: '#a78bfa' }}>{creatorName}</strong>'s
                    exclusive content & chat
                </motion.p>

                {/* ── Perks row ───────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.4 }}
                    style={{
                        width: '100%',
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 10, marginBottom: 28,
                    }}
                >
                    {[
                        { icon: '💬', label: 'Private Chat' },
                        { icon: '📸', label: 'Exclusive Posts' },
                        { icon: '🎁', label: 'Send Gifts' },
                    ].map(({ icon, label }) => (
                        <div key={label} style={{
                            background: 'rgba(124,58,237,0.06)',
                            border: '1px solid rgba(124,58,237,0.15)',
                            borderRadius: 16, padding: '14px 8px',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                            <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontWeight: 600, fontSize: 12, margin: 0,
                                letterSpacing: '-0.01em',
                            }}>{label}</p>
                        </div>
                    ))}
                </motion.div>

                {/* ── Primary CTA — Start Chatting ────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                    {chatId ? (
                        <Link
                            to={`/chat/${chatId}`}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                width: '100%', boxSizing: 'border-box',
                                padding: '16px 24px', borderRadius: 18,
                                background: 'linear-gradient(135deg, #7c3aed, #a855f7 50%, #cc52b8)',
                                boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
                                color: '#fff', fontWeight: 800,
                                fontSize: 'clamp(15px, 3.8vw, 16px)',
                                textDecoration: 'none', letterSpacing: '-0.01em',
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(124,58,237,0.55)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.45)'; }}
                        >
                            <span style={{ fontSize: 20 }}>💬</span>
                            Start Chatting with {creatorName}
                        </Link>
                    ) : creatorUsername ? (
                        <Link
                            to={`/creator/${creatorUsername}`}
                            state={{ subscribed: true }}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                width: '100%', boxSizing: 'border-box',
                                padding: '16px 24px', borderRadius: 18,
                                background: 'linear-gradient(135deg, #7c3aed, #a855f7 50%, #cc52b8)',
                                boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
                                color: '#fff', fontWeight: 800,
                                fontSize: 'clamp(15px, 3.8vw, 16px)',
                                textDecoration: 'none',
                                transition: 'transform 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            View {creatorName}'s Profile
                        </Link>
                    ) : null}

                    {chatId && creatorUsername && (
                        <Link
                            to={`/creator/${creatorUsername}`}
                            style={{
                                display: 'block', textAlign: 'center', boxSizing: 'border-box',
                                padding: '14px 0', borderRadius: 16, width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.55)',
                                fontWeight: 600, fontSize: 14, textDecoration: 'none',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                        >
                            View {creatorName}'s Profile
                        </Link>
                    )}

                    <Link
                        to="/explore"
                        style={{
                            display: 'block', textAlign: 'center',
                            padding: '12px 0', borderRadius: 14,
                            color: 'rgba(255,255,255,0.3)', fontSize: 14,
                            fontWeight: 500, textDecoration: 'none',
                            transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                    >
                        Explore more creators →
                    </Link>
                </motion.div>
            </motion.div>
            <style>{globalKeyframes}</style>
        </div>
    );
}

/* ── Shared style tokens ──────────────────────────────────────────────────── */
const pageStyle = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050208',
    fontFamily: "'Inter', sans-serif",
    position: 'relative',
    overflow: 'hidden',
    padding: '24px 0',
};

const cardStyle = {
    position: 'relative',
    zIndex: 1,
    maxWidth: 400,
    width: '100%',
    margin: '0 16px',
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 28,
    padding: '36px 28px 28px',
};

const headingStyle = {
    color: '#fff',
    fontWeight: 900,
    fontSize: 22,
    margin: '0 0 8px',
    letterSpacing: '-0.3px',
};

const subtitleStyle = {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    margin: '0 0 6px',
    lineHeight: 1.6,
};

const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 28px',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #a855f7, #ec4899)',
    boxShadow: '0 8px 24px rgba(168,85,247,0.4)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    textDecoration: 'none',
};

const spinnerStyle = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '2.5px solid rgba(168,85,247,0.2)',
    borderTopColor: '#a855f7',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
};

const globalKeyframes = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.25; } 50% { transform: scale(1.15); opacity: 0.4; } }
    @keyframes pulseRing { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.15); opacity: 0; } }
`;

/* ── Decorative background orbs ─────────────────────────────────────────────── */
function Orbs({ colors = ['#10b981', '#7c3aed'] }) {
    return (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div style={{
                position: 'absolute', top: '25%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400, height: 400, borderRadius: '50%', opacity: 0.15,
                background: `radial-gradient(circle, ${colors[0]}, transparent 65%)`,
            }} />
            <div style={{
                position: 'absolute', bottom: '20%', right: '15%',
                width: 280, height: 280, borderRadius: '50%', opacity: 0.1,
                background: `radial-gradient(circle, ${colors[1]}, transparent 65%)`,
            }} />
        </div>
    );
}
