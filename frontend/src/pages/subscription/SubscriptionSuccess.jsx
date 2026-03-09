import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import chatService from '../../services/chatService';

export default function SubscriptionSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const cfOrderId = searchParams.get('order_id');

    const [verifying, setVerifying] = useState(!!cfOrderId);
    const [error, setError] = useState('');
    const [verified, setVerified] = useState(false);

    // Result data from verify
    const [orderType, setOrderType] = useState('subscription');
    const [creator, setCreator] = useState(null);
    const [chatId, setChatId] = useState(null);
    const [redirecting, setRedirecting] = useState(false);
    // For wallet recharge
    const [walletBalance, setWalletBalance] = useState(null);
    const [walletAmount, setWalletAmount] = useState(null);
    // For gift-from-chat: store the chatId to go back to
    const [sourceChatId, setSourceChatId] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!cfOrderId) { setVerified(true); return; }

        const verify = async () => {
            try {
                const { data } = await api.post('/payment/verify', { orderId: cfOrderId, creatorId: null });
                if (data.success) {
                    setVerified(true);
                    setOrderType(data.type || 'subscription');
                    setChatId(data.chatId || null);

                    if (data.type === 'chat_unlock' && data.chatId) {
                        setRedirecting(true);
                        timerRef.current = setTimeout(() => navigate(`/chat/${data.chatId}`, { replace: true }), 2000);
                    } else if (data.type === 'wallet') {
                        setWalletBalance(data.walletBalance);
                        setWalletAmount(data.amount);
                    } else if (data.creator) {
                        setCreator(data.creator);
                    }

                    // If this was a gift sent FROM chat, post the gift message to chat thread
                    if (data.type === 'gift') {
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
                            } catch (_) { /* Silent — message may already have been posted by webhook */ }
                        }
                    }
                } else {
                    setError('Payment could not be verified. Please contact support@fannex.in');
                }
            } catch (err) {
                setError(err?.response?.data?.message || 'Verification failed. Please contact support@fannex.in');
            } finally {
                setVerifying(false);
                refreshUser().catch(() => { });
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
                            New balance: <strong style={{ color: '#fff' }}>₹{walletBalance}</strong>
                        </p>
                    )}
                    <Link to="/chat" style={btnPrimary}>Go to Chat</Link>
                </div>
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
                    {cfOrderId && <p style={orderStyle}>Order: {cfOrderId}</p>}
                    {redirecting ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 24 }}>
                            <div style={{ ...spinnerStyle, borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }} />
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Opening your chat…</p>
                        </div>
                    ) : chatId && (
                        <Link to={`/chat/${chatId}`} style={{ ...btnPrimary, marginTop: 24 }}>Open Chat</Link>
                    )}
                </div>
            </div>
        );
    }

    /* ── Gift Success screen ───────────────────────────────────────────────────── */
    if (orderType === 'gift') {
        const giftCreatorName = creator?.name || 'the creator';
        const giftCreatorUsername = creator?.username;
        const giftProfileImage = creator?.profileImage;
        const giftAmount = verified ? (creator?.amount ?? null) : null;

        return (
            <div style={{ ...pageStyle, justifyContent: 'center' }}>
                <Orbs colors={['#ff7a18', '#ffb347']} />
                <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 16px' }}>

                    {/* Floating confetti-style orb */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{
                            position: 'relative', display: 'inline-block',
                        }}>
                            {/* Outer glow ring */}
                            <div style={{
                                position: 'absolute', inset: -14,
                                borderRadius: '50%',
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

                    {/* Main card */}
                    <div style={{
                        background: 'linear-gradient(160deg, #0e0e1e, #130a00)',
                        border: '1px solid rgba(255,122,24,0.2)',
                        borderRadius: 28,
                        padding: '28px 24px 24px',
                        textAlign: 'center',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,180,71,0.08)',
                    }}>
                        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
                            Gift Sent! 🎉
                        </h1>
                        <p style={{ color: 'rgba(255,180,71,0.7)', fontSize: 14, margin: '0 0 22px', lineHeight: 1.6 }}>
                            Your heartfelt gift is on its way to someone special
                        </p>

                        {/* Creator receipt row */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,122,24,0.15)',
                            borderRadius: 18, padding: '14px 16px',
                            marginBottom: 18,
                        }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                                border: '2px solid rgba(255,122,24,0.4)',
                                background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                            }}>
                                {giftProfileImage
                                    ? <img src={giftProfileImage} alt={giftCreatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{giftCreatorName[0]?.toUpperCase()}</span>
                                }
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>
                                    To {giftCreatorName}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0 }}>
                                    Your favorite creator
                                </p>
                            </div>
                            {/* Gift amount badge */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255,122,24,0.2), rgba(255,179,71,0.15))',
                                border: '1px solid rgba(255,122,24,0.35)',
                                borderRadius: 12, padding: '6px 14px',
                                color: '#ffb347', fontWeight: 900, fontSize: 16,
                                flexShrink: 0,
                            }}>
                                {cfOrderId ? `₹${Number(cfOrderId.split('_').pop() || 0)}` : '🎁'}
                            </div>
                        </div>

                        {/* Order ID */}
                        {cfOrderId && (
                            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, fontFamily: 'monospace', margin: '0 0 20px' }}>
                                Order: {cfOrderId}
                            </p>
                        )}

                        {/* Heartfelt note */}
                        <div style={{
                            background: 'rgba(255,122,24,0.06)',
                            border: '1px solid rgba(255,122,24,0.12)',
                            borderRadius: 16, padding: '14px 16px', marginBottom: 22,
                        }}>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                                ✨ You just made <strong style={{ color: 'rgba(255,180,71,0.8)' }}>{giftCreatorName}</strong>'s day a little brighter.
                                Creators like <strong style={{ color: 'rgba(255,180,71,0.8)' }}>{giftCreatorName}</strong> are fuelled
                                by the love and support of amazing fans like you.
                            </p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* If gift was sent from chat, show prominent "Back to Chat" button first */}
                            {sourceChatId && (
                                <Link
                                    to={`/chat/${sourceChatId}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        padding: '14px 0', borderRadius: 999,
                                        background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                        boxShadow: '0 6px 20px rgba(255,122,24,0.4)',
                                        color: '#fff', fontWeight: 800, fontSize: 15,
                                        textDecoration: 'none', letterSpacing: '-0.01em',
                                    }}
                                >
                                    <span>💬</span>
                                    Back to Chat
                                </Link>
                            )}
                            {!sourceChatId && giftCreatorUsername && (
                                <Link
                                    to={`/creator/${giftCreatorUsername}`}
                                    style={{
                                        display: 'block', textAlign: 'center',
                                        padding: '14px 0', borderRadius: 999,
                                        background: 'linear-gradient(135deg, #ff7a18, #ffb347)',
                                        boxShadow: '0 6px 20px rgba(255,122,24,0.4)',
                                        color: '#fff', fontWeight: 800, fontSize: 15,
                                        textDecoration: 'none', letterSpacing: '-0.01em',
                                    }}
                                >
                                    Visit {giftCreatorName}'s Profile
                                </Link>
                            )}
                            {sourceChatId && giftCreatorUsername && (
                                <Link
                                    to={`/creator/${giftCreatorUsername}`}
                                    style={{
                                        display: 'block', textAlign: 'center',
                                        padding: '12px 0', borderRadius: 16,
                                        background: 'rgba(255,255,255,0.07)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14,
                                        textDecoration: 'none',
                                    }}
                                >
                                    View {giftCreatorName}'s Profile
                                </Link>
                            )}
                            <Link
                                to="/explore"
                                style={{
                                    display: 'block', textAlign: 'center', padding: '12px 0',
                                    color: 'rgba(255,255,255,0.35)', fontSize: 14, textDecoration: 'none',
                                    transition: 'color 0.15s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                            >
                                Explore more creators →
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Subscription Success ─────────────────────────────────────────────────── */
    const creatorName = creator?.name || 'the creator';
    const creatorUsername = creator?.username;
    const coverImage = creator?.coverImage;
    const profileImage = creator?.profileImage;

    return (
        <div style={{ ...pageStyle, alignItems: 'flex-start', overflowY: 'auto', paddingBottom: 40 }}>
            <Orbs colors={['#10b981', '#7c3aed']} />

            <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', position: 'relative', zIndex: 1 }}>

                {/* ── Cover strip ───────────────────────────────────────────── */}
                <div style={{
                    position: 'relative',
                    height: 160,
                    background: coverImage
                        ? undefined
                        : 'linear-gradient(135deg, #3a0060, #0d0020 55%, #1a0040)',
                    overflow: 'hidden',
                    borderRadius: '0 0 0 0',
                }}>
                    {coverImage && (
                        <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(5,2,8,0.85) 100%)',
                    }} />

                    {/* Success badge on top */}
                    <div style={{
                        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        borderRadius: 999, padding: '6px 16px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        whiteSpace: 'nowrap',
                    }}>
                        <span style={{ fontSize: 14 }}>✅</span>
                        <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>Payment Successful</span>
                    </div>
                </div>

                {/* ── Creator identity card ──────────────────────────────────── */}
                <div style={{
                    background: 'rgba(10,10,20,0.96)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderTop: 'none',
                    padding: '0 20px 24px',
                    position: 'relative',
                }}>
                    {/* Avatar peeking out of cover */}
                    <div style={{
                        marginTop: -40,
                        marginBottom: 14,
                        display: 'flex',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            border: '3px solid rgba(168,85,247,0.6)',
                            boxShadow: '0 0 0 4px rgba(5,2,8,1), 0 8px 24px rgba(168,85,247,0.35)',
                            overflow: 'hidden', flexShrink: 0,
                            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {profileImage
                                ? <img src={profileImage} alt={creatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>{creatorName[0]?.toUpperCase()}</span>
                            }
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                            You're subscribed! 🎉
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
                            to <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{creatorName}</strong>
                        </p>
                        {creator?.bio && (
                            <p style={{
                                color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 8,
                                lineHeight: 1.5, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto',
                            }}>
                                {creator.bio}
                            </p>
                        )}
                    </div>

                    {cfOrderId && (
                        <p style={{ ...orderStyle, textAlign: 'center' }}>Order: {cfOrderId}</p>
                    )}
                </div>

                {/* ── Chat Benefits Unlocked banner ──────────────────────────── */}
                {creator?.chatEnabled !== false && (
                    <div style={{
                        margin: '16px 16px 0',
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(204,82,184,0.08))',
                        border: '1px solid rgba(124,58,237,0.25)',
                        borderRadius: 22,
                        overflow: 'hidden',
                    }}>
                        {/* Banner header */}
                        <div style={{
                            padding: '16px 20px 12px',
                            borderBottom: '1px solid rgba(124,58,237,0.15)',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
                                flexShrink: 0,
                            }}>
                                <span style={{ fontSize: 16 }}>💬</span>
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0, letterSpacing: '-0.2px' }}>
                                    Chat Benefits Unlocked
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
                                    Included with your subscription
                                </p>
                            </div>
                        </div>

                        {/* Benefits grid */}
                        <div style={{ padding: '14px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { icon: '💬', title: 'Private Messaging', desc: 'Direct chat with creator' },
                                { icon: '📷', title: 'Photo Sharing', desc: 'Share images in chat' },
                                { icon: '🎁', title: 'Send Gifts', desc: 'Surprise the creator' },
                                { icon: '⚡', title: 'Priority Replies', desc: 'Subscriber-only perks' },
                            ].map(({ icon, title, desc }) => (
                                <div key={title} style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 14,
                                    padding: '12px 12px',
                                }}>
                                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: '0 0 2px' }}>{title}</p>
                                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0, lineHeight: 1.4 }}>{desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Start chatting CTA */}
                        {chatId ? (
                            <div style={{ padding: '0 16px 16px' }}>
                                <Link
                                    to={`/chat/${chatId}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '14px 0', borderRadius: 16,
                                        background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                                        boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
                                        color: '#fff', fontWeight: 800, fontSize: 15,
                                        textDecoration: 'none', letterSpacing: '-0.01em',
                                        transition: 'transform 0.15s ease',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                    <span>💬</span>
                                    Start Chatting with {creatorName}
                                </Link>
                            </div>
                        ) : (
                            <div style={{ padding: '0 16px 16px' }}>
                                <div style={{
                                    padding: '12px 16px',
                                    background: 'rgba(74,222,128,0.08)',
                                    border: '1px solid rgba(74,222,128,0.2)',
                                    borderRadius: 14,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <span style={{ fontSize: 18 }}>✅</span>
                                    <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
                                        Chat access ready — go to the creator's profile to start chatting!
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Action buttons ────────────────────────────────────────── */}
                <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {creatorUsername && (
                        <Link
                            to={`/creator/${creatorUsername}`}
                            style={{
                                display: 'block', textAlign: 'center',
                                padding: '14px 0', borderRadius: 16,
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff', fontWeight: 700, fontSize: 15,
                                textDecoration: 'none',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        >
                            View {creatorName}'s Profile
                        </Link>
                    )}
                    <Link
                        to="/explore"
                        style={{
                            display: 'block', textAlign: 'center',
                            padding: '14px 0', borderRadius: 16,
                            color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 600,
                            textDecoration: 'none', background: 'none',
                            transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                        Explore Creators →
                    </Link>
                </div>
            </div>
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

const orderStyle = {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 8,
    marginBottom: 0,
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
    letterSpacing: '-0.01em',
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
