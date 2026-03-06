import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import ChatUnlockModal from './ChatUnlockModal';

/**
 * ChatButton — placed on creator profile pages and post-subscription success screens.
 * Always shows for creators (unless viewing own profile).
 * Handles: not-logged-in → login, chat-unavailable → info, not-paid → payment, paid → open chat.
 */
export default function ChatButton({ creatorId, creatorName, chatPrice: propPrice, className = '', variant = 'default' }) {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null); // { isPaid, chatId, profile }
    const [showUnlock, setShowUnlock] = useState(false);
    const [loading, setLoading] = useState(true);

    // Don't show chat button to the creator themselves
    const isSelf = user?._id === creatorId || user?._id?.toString() === creatorId?.toString();

    useEffect(() => {
        if (isSelf || !creatorId || !isAuthenticated) { setLoading(false); return; }
        chatService.getStatus(creatorId)
            .then(({ data }) => setStatus(data.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [creatorId, isAuthenticated, isSelf]);

    if (isSelf || loading) return null;

    const chatEnabled = status?.profile?.chatEnabled || (status?.profile?.chatPrice && status?.profile?.chatPrice > 0);
    const isPaid = status?.isPaid && status?.chatId;
    const price = propPrice ?? status?.profile?.chatPrice ?? 199;

    const handleClick = () => {
        if (!isAuthenticated) {
            navigate(`/login?redirect=/creator/${creatorId}`);
            return;
        }
        if (!chatEnabled) return; // button is shown but disabled
        if (isPaid && status?.chatId) {
            navigate(`/chat/${status.chatId}`);
            return;
        }
        setShowUnlock(true);
    };

    const handleUnlocked = (chatId) => {
        setShowUnlock(false);
        setStatus(prev => ({ ...prev, isPaid: true, chatId }));
        navigate(`/chat/${chatId}`);
    };

    // ── Variants ──────────────────────────────────────────────────────────────
    if (variant === 'banner') {
        // Large premium banner style — used after subscription success
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
                    <span>
                        {!chatEnabled ? 'Chat Unavailable' : isPaid ? 'Open Chat' : `Chat with ${creatorName} — ₹${price}`}
                    </span>
                    {chatEnabled && !isPaid && (
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                </button>
                {showUnlock && (
                    <ChatUnlockModal
                        creatorId={creatorId}
                        creatorName={creatorName}
                        chatPrice={price}
                        onSuccess={handleUnlocked}
                        onClose={() => setShowUnlock(false)}
                    />
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
                {!chatEnabled
                    ? 'Chat Unavailable'
                    : isPaid
                        ? 'Open Chat'
                        : `Chat — ₹${price}`}
            </button>

            {showUnlock && (
                <ChatUnlockModal
                    creatorId={creatorId}
                    creatorName={creatorName}
                    chatPrice={price}
                    onSuccess={handleUnlocked}
                    onClose={() => setShowUnlock(false)}
                />
            )}
        </>
    );
}
