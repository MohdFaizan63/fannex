import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import chatService, { connectSocket, getSocket } from '../services/chatService';
import ChatWindow from '../components/chat/ChatWindow';
import GiftPanel from '../components/chat/GiftPanel';
import WalletRechargeModal from '../components/WalletRechargeModal';
import api from '../services/api';

export default function Chat() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [otherName, setOtherName] = useState('Creator');
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherOnline, setIsOtherOnline] = useState(false);
    const [text, setText] = useState('');
    const [showGifts, setShowGifts] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);
    const [page, setPage] = useState(1);
    const typingTimeout = useRef(null);
    const socketRef = useRef(null);

    // Fetch wallet balance on mount
    useEffect(() => {
        api.get('/payments/wallet-balance')
            .then(r => setWalletBalance(r.data.data.walletBalance))
            .catch(() => { });
    }, []);

    // ── Load messages ──────────────────────────────────────────────────────────
    const loadMessages = useCallback(async (p = 1) => {
        try {
            const { data } = await chatService.getMessages(chatId, { page: p, limit: 30 });
            setMessages(prev => p === 1 ? data.data : [...data.data, ...prev]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [chatId]);

    useEffect(() => { loadMessages(1); }, [loadMessages]);

    // ── Socket.io connection ───────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('fannex_token');
        const socket = connectSocket(token);
        socketRef.current = socket;

        socket.emit('join_room', { chatId });
        socket.emit('mark_seen', { chatId });

        socket.on('new_message', (msg) => {
            setMessages(prev => {
                // If this message was sent by the current user, it was already
                // added optimistically. Replace the placeholder (opt-*) with the
                // confirmed server message so we don't show it twice.
                const optimisticIdx = prev.findIndex(
                    (m) =>
                        m._id?.toString().startsWith('opt-') &&
                        m.senderId?.toString() === msg.senderId?.toString() &&
                        m.content === msg.content
                );
                if (optimisticIdx !== -1) {
                    const updated = [...prev];
                    updated[optimisticIdx] = msg; // swap placeholder → confirmed
                    return updated;
                }
                // Message from the other party — just append it
                return [...prev, msg];
            });
            socket.emit('mark_seen', { chatId });
        });

        socket.on('typing', ({ isTyping: t }) => {
            setIsTyping(t);
            if (t) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
            }
        });

        socket.on('user_online', ({ userId, online }) => {
            // Mark other party online (we'd need their id — simplified check)
            setIsOtherOnline(online);
        });

        return () => {
            socket.off('new_message');
            socket.off('typing');
            socket.off('user_online');
        };
    }, [chatId]);

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const socket = getSocket();
        socket?.emit('send_message', { chatId, type: 'text', content: trimmed });

        // Optimistic UI
        setMessages(prev => [...prev, {
            _id: `opt-${Date.now()}`,
            senderId: user._id,
            type: 'text',
            content: trimmed,
            createdAt: new Date().toISOString(),
            seen: false,
        }]);

        setText('');
    };

    // ── Typing indicator ───────────────────────────────────────────────────────
    const handleTyping = (e) => {
        setText(e.target.value);
        const socket = getSocket();
        socket?.emit('typing', { chatId, isTyping: true });
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            socket?.emit('typing', { chatId, isTyping: false });
        }, 1500);
    };

    const handleGiftSent = (msg) => {
        setMessages(prev => [...prev, msg]);
    };

    if (loading) {
        return (
            <div style={{ height: '100dvh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div style={{
            height: '100dvh',
            background: '#080810',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
            overflow: 'hidden',
        }}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(10,10,21,0.95)',
                backdropFilter: 'blur(12px)',
                flexShrink: 0,
            }}>
                <button onClick={() => navigate(-1)} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'rgba(124,58,237,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 14,
                    }}>
                        {otherName[0]?.toUpperCase()}
                    </div>
                    {isOtherOnline && (
                        <span style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 11, height: 11, borderRadius: '50%',
                            background: '#4ade80', border: '2px solid #080810',
                        }} />
                    )}
                </div>

                <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{otherName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>
                        {isOtherOnline ? '🟢 Online' : 'Offline'}
                    </div>
                </div>

                {/* Right side: wallet + gift */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {walletBalance !== null && (
                        <button
                            onClick={() => setShowWallet(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                            }}
                            title="Tap to recharge wallet"
                        >
                            <span>💳</span><span>₹{walletBalance}</span>
                        </button>
                    )}
                    <button onClick={() => setShowGifts(true)} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer' }} title="Send a gift">🎁</button>
                </div>
            </div>

            {/* ── Messages — flex-grows, scrolls internally ──────────────────── */}
            <ChatWindow
                messages={messages}
                currentUserId={user?._id}
                otherName={otherName}
                isTyping={isTyping}
                onScrollTop={() => {
                    setPage(p => {
                        const next = p + 1;
                        loadMessages(next);
                        return next;
                    });
                }}
            />

            {/* ── Input bar — anchored to bottom ─────────────────────────────── */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(10,10,21,0.95)',
                backdropFilter: 'blur(12px)',
                padding: '10px 16px',
                display: 'flex', alignItems: 'flex-end', gap: 10,
                flexShrink: 0,
            }}>
                <button onClick={() => setShowGifts(true)} style={{ fontSize: 20, flexShrink: 0, marginBottom: 4, background: 'none', border: 'none', cursor: 'pointer' }}>🎁</button>

                <div style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 24, padding: '10px 16px',
                    minHeight: 44, maxHeight: 120, display: 'flex', alignItems: 'center',
                }}>
                    <textarea
                        value={text}
                        onChange={handleTyping}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Message..."
                        rows={1}
                        style={{
                            flex: 1, background: 'transparent', color: '#fff',
                            fontSize: 14, resize: 'none', outline: 'none',
                            border: 'none', maxHeight: 80, overflowY: 'auto',
                        }}
                    />
                </div>

                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSend}
                    disabled={!text.trim()}
                    style={{
                        width: 40, height: 40, flexShrink: 0, borderRadius: '50%',
                        background: '#7c3aed', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
                        opacity: text.trim() ? 1 : 0.3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'opacity 0.15s',
                    }}
                >
                    <svg width="16" height="16" fill="white" viewBox="0 0 24 24" style={{ transform: 'rotate(90deg)' }}>
                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                    </svg>
                </motion.button>
            </div>

            {/* ── Gift panel ─────────────────────────────────────────────────── */}
            {showGifts && (
                <GiftPanel
                    chatId={chatId}
                    creatorName={otherName}
                    onGiftSent={handleGiftSent}
                    onClose={() => setShowGifts(false)}
                />
            )}

            {/* ── Wallet Recharge Modal ──────────────────────────────────────── */}
            {showWallet && (
                <WalletRechargeModal
                    currentBalance={walletBalance ?? 0}
                    onClose={() => setShowWallet(false)}
                    onRecharged={(newBal) => setWalletBalance(newBal)}
                />
            )}
        </div>
    );
}
