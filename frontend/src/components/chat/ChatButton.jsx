import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';

/**
 * ChatButton — placed on creator profile pages.
 * Chat is now FREE for subscribers — no separate unlock payment.
 * Non-subscribers see a "Subscribe first" modal.
 */
export default function ChatButton({ creatorId, creatorName, className = '', variant = 'default' }) {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSubscribeFirst, setShowSubscribeFirst] = useState(false);

    const isSelf = user?._id === creatorId || user?._id?.toString() === creatorId?.toString();

    useEffect(() => {
        if (isSelf || !creatorId || !isAuthenticated) { setLoading(false); return; }
        chatService.getStatus(creatorId)
            .then(({ data }) => setStatus(data.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [creatorId, isAuthenticated, isSelf]);

    if (isSelf) return null;

    const chatEnabled = status?.profile?.chatEnabled ?? true;
    const isPaid = status?.isPaid && status?.chatId;
    const isSubscriber = status?.isSubscriber ?? false;

    const handleClick = () => {
        if (!isAuthenticated) { navigate(`/login?redirect=/creator/${creatorId}`); return; }
        if (!chatEnabled) return;
        if (isPaid && status?.chatId) { navigate(`/chat/${status.chatId}`); return; }
        // Not subscribed — show the subscribe-first gate
        setShowSubscribeFirst(true);
    };

    // ── Subscribe-first modal ────────────────────────────────────────────────
    const SubscribeFirstModal = () => (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 60,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
            }}
            onClick={() => setShowSubscribeFirst(false)}
        >
            <div
                style={{
                    background: 'linear-gradient(160deg, #0e0e1e, #12091f)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 28,
                    padding: '36px 28px 28px',
                    width: '100%',
                    maxWidth: 360,
                    textAlign: 'center',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div style={{
                    width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(204,82,184,0.2))',
                    border: '2px solid rgba(124,58,237,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 28px rgba(124,58,237,0.2)',
                }}>
                    <span style={{ fontSize: 30 }}>💬</span>
                </div>

                <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
                    Subscribe to Chat
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
                    Subscribe to <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{creatorName}</strong> to unlock
                    private messaging and exclusive benefits.
                </p>

                {/* Benefits list */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 18,
                    padding: '16px 18px',
                    marginBottom: 22,
                    textAlign: 'left',
                }}>
                    {[
                        { icon: '💬', text: 'Private messages with creator' },
                        { icon: '📷', text: 'Share photos in chat' },
                        { icon: '🎁', text: 'Send & receive gifts' },
                        { icon: '🔓', text: 'Exclusive subscriber content' },
                    ].map(({ icon, text }) => (
                        <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500 }}>{text}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => {
                        setShowSubscribeFirst(false);
                        navigate(`/creator/${status?.profile?.username || creatorId}/subscribe`);
                    }}
                    style={{
                        width: '100%', padding: '15px 0', borderRadius: 999, border: 'none',
                        background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)',
                        boxShadow: '0 8px 24px rgba(168,85,247,0.4)',
                        color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
                        cursor: 'pointer', letterSpacing: '-0.01em',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(168,85,247,0.55)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,85,247,0.4)'; }}
                >
                    Subscribe to Unlock Chat
                </button>

                <button
                    onClick={() => setShowSubscribeFirst(false)}
                    style={{
                        marginTop: 14, display: 'block', width: '100%',
                        color: 'rgba(255,255,255,0.3)', fontSize: 13, background: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                >
                    Maybe later
                </button>
            </div>
        </div>
    );

    // ── Profile variant — full-width button ──────────────────────────────────
    if (variant === 'profile') {
        const isGuest = !isAuthenticated;
        const isDisabled = !isGuest && !chatEnabled;

        const handleProfileClick = () => {
            if (isGuest) { navigate(`/login?redirect=/creator/${creatorId}`); return; }
            if (!chatEnabled) return;
            handleClick();
        };

        return (
            <>
                <button
                    onClick={handleProfileClick}
                    disabled={isDisabled || loading}
                    title={
                        isGuest ? 'Login to chat' :
                            !chatEnabled ? 'Creator has disabled chat' : undefined
                    }
                    className="creator-btn-secondary"
                    style={{
                        height: 50, borderRadius: 14,
                        background: isDisabled
                            ? 'rgba(251,191,36,0.05)'
                            : isPaid
                                ? 'linear-gradient(135deg, rgba(22,163,74,0.12), rgba(21,128,61,0.06))'
                                : 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(168,85,247,0.05))',
                        border: isDisabled
                            ? '1.5px solid rgba(251,191,36,0.18)'
                            : isPaid
                                ? '1.5px solid rgba(74,222,128,0.3)'
                                : '1.5px solid rgba(139,92,246,0.25)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        color: isDisabled ? 'rgba(251,191,36,0.45)' : '#fff',
                        fontWeight: 700, fontSize: 14,
                        cursor: isDisabled || loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        letterSpacing: '-0.01em',
                        opacity: loading ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                        width: '100%',
                    }}
                    onMouseEnter={e => {
                        if (!isDisabled && !loading) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = isPaid
                                ? '0 8px 24px rgba(34,197,94,0.25)'
                                : '0 8px 24px rgba(139,92,246,0.2)';
                            e.currentTarget.style.borderColor = isPaid
                                ? 'rgba(74,222,128,0.5)'
                                : 'rgba(139,92,246,0.45)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!isDisabled && !loading) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = isPaid
                                ? 'rgba(74,222,128,0.3)'
                                : 'rgba(139,92,246,0.25)';
                        }
                    }}
                >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{isDisabled ? '🔒' : '💬'}</span>
                    <span>{isDisabled ? 'Chat Locked' : isPaid ? 'Message Now' : 'Send Message'}</span>
                </button>
                {showSubscribeFirst && <SubscribeFirstModal />}
            </>
        );

    }

    // ── Default pill style ────────────────────────────────────────────────────
    return (
        <>
            <button
                onClick={handleClick}
                disabled={!chatEnabled || loading}
                title={!chatEnabled ? 'Creator has not enabled chat yet' : undefined}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${!chatEnabled
                    ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    : isPaid
                        ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
                        : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-lg hover:shadow-violet-500/30'
                    } ${className}`}
            >
                <span className="text-base">💬</span>
                {!chatEnabled ? 'Chat Unavailable' : isPaid ? 'Open Chat' : 'Message'}
            </button>
            {showSubscribeFirst && <SubscribeFirstModal />}
        </>
    );
}
