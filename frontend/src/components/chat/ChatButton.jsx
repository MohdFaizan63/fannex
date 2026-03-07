import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import ChatUnlockModal from './ChatUnlockModal';

/**
 * ChatButton — placed on creator profile pages and post-subscription success screens.
 * Variants: 'default' (pill), 'banner' (large), 'profile' (full-width vertical stack).
 * isSubscribed prop is used by 'profile' variant to gate chat access.
 */
export default function ChatButton({ creatorId, creatorName, chatPrice: propPrice, className = '', variant = 'default', isSubscribed = true }) {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [showUnlock, setShowUnlock] = useState(false);
    const [loading, setLoading] = useState(true);

    const isSelf = user?._id === creatorId || user?._id?.toString() === creatorId?.toString();

    useEffect(() => {
        if (isSelf || !creatorId || !isAuthenticated) { setLoading(false); return; }
        chatService.getStatus(creatorId)
            .then(({ data }) => setStatus(data.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [creatorId, isAuthenticated, isSelf]);

    // For 'profile' variant, always render even for guests (clicking → login redirect)
    if (isSelf) return null;
    if (loading && variant !== 'profile') return null;

    const chatEnabled = status?.profile?.chatEnabled || (status?.profile?.chatPrice && status?.profile?.chatPrice > 0);
    const isPaid = status?.isPaid && status?.chatId;
    const price = propPrice ?? status?.profile?.chatPrice ?? 199;

    const handleClick = () => {
        if (!isAuthenticated) { navigate(`/login?redirect=/creator/${creatorId}`); return; }
        if (!chatEnabled) return;
        if (isPaid && status?.chatId) { navigate(`/chat/${status.chatId}`); return; }
        setShowUnlock(true);
    };

    const handleUnlocked = (chatId) => {
        setShowUnlock(false);
        setStatus(prev => ({ ...prev, isPaid: true, chatId }));
        navigate(`/chat/${chatId}`);
    };

    // ── Profile variant — full-width vertical stack ───────────────────────────
    if (variant === 'profile') {
        // Not logged in → show button, click → login redirect (same as Subscribe)
        const isGuest = !isAuthenticated;
        const notSubscribed = !isGuest && !isSubscribed;
        // Only truly disabled when creator hasn't enabled chat AND user is logged in
        const isClickable = isGuest || isSubscribed;
        const isDisabled = !isGuest && (notSubscribed || !chatEnabled);

        const handleProfileClick = () => {
            if (isGuest) { navigate(`/login?redirect=/creator/${creatorId}`); return; }
            if (notSubscribed || !chatEnabled) return;
            handleClick();
        };

        return (
            <>
                <button
                    onClick={handleProfileClick}
                    disabled={isDisabled}
                    title={
                        isGuest ? 'Login to chat' :
                            notSubscribed ? 'Subscribe first to unlock chat' :
                                !chatEnabled ? 'Creator has not enabled chat' : undefined
                    }
                    style={{
                        flex: 1, height: 52, borderRadius: 999,
                        background: isDisabled ? 'rgba(255,255,255,0.03)' : isPaid ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.07)',
                        border: isDisabled ? '1.5px solid rgba(255,255,255,0.07)' : isPaid ? '1.5px solid rgba(74,222,128,0.3)' : '1.5px solid rgba(255,255,255,0.12)',
                        color: isDisabled ? 'rgba(255,255,255,0.2)' : isPaid ? '#4ade80' : '#fff',
                        fontWeight: 700, fontSize: 15,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isDisabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; } }}
                    onMouseLeave={e => { if (!isDisabled) { e.currentTarget.style.background = isPaid ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = isPaid ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)'; } }}
                >
                    <span style={{ fontSize: 18 }}>💬</span>
                    <span>{isPaid ? 'Open Chat' : 'Chat'}</span>
                </button>
                {showUnlock && (
                    <ChatUnlockModal creatorId={creatorId} creatorName={creatorName} chatPrice={price}
                        onSuccess={handleUnlocked} onClose={() => setShowUnlock(false)} />
                )}
            </>
        );
    }

    // ── Banner variant ────────────────────────────────────────────────────────
    if (variant === 'banner') {
        return (
            <>
                <button
                    onClick={handleClick}
                    disabled={!chatEnabled}
                    className={`group relative overflow-hidden flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-base transition-all duration-300 ${!chatEnabled
                        ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                        : isPaid
                            ? 'bg-green-500/15 border border-green-500/40 text-green-300 hover:bg-green-500/25'
                            : 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-[1.02]'
                        } ${className}`}
                >
                    <span className="text-xl">💬</span>
                    <span>{!chatEnabled ? 'Chat Unavailable' : isPaid ? 'Open Chat' : `Chat with ${creatorName} — ₹${price}`}</span>
                    {chatEnabled && !isPaid && (
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                </button>
                {showUnlock && (
                    <ChatUnlockModal creatorId={creatorId} creatorName={creatorName} chatPrice={price}
                        onSuccess={handleUnlocked} onClose={() => setShowUnlock(false)} />
                )}
            </>
        );
    }

    // ── Default pill style ────────────────────────────────────────────────────
    return (
        <>
            <button
                onClick={handleClick}
                disabled={!chatEnabled}
                title={!chatEnabled ? 'Creator has not enabled chat yet' : undefined}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${!chatEnabled
                    ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    : isPaid
                        ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
                        : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-lg hover:shadow-violet-500/30'
                    } ${className}`}
            >
                <span className="text-base">💬</span>
                {!chatEnabled ? 'Chat Unavailable' : isPaid ? 'Open Chat' : `Chat — ₹${price}`}
            </button>
            {showUnlock && (
                <ChatUnlockModal creatorId={creatorId} creatorName={creatorName} chatPrice={price}
                    onSuccess={handleUnlocked} onClose={() => setShowUnlock(false)} />
            )}
        </>
    );
}
