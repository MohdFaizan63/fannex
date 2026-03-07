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

    // Lock body to 100% height so keyboard-resize works on Android Chrome
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlStyle = { height: html.style.height, overflow: html.style.overflow };
        const prevBodyStyle = { height: body.style.height, overflow: body.style.overflow };
        html.style.height = '100%';
        html.style.overflow = 'hidden';
        body.style.height = '100%';
        body.style.overflow = 'hidden';
        return () => {
            html.style.height = prevHtmlStyle.height;
            html.style.overflow = prevHtmlStyle.overflow;
            body.style.height = prevBodyStyle.height;
            body.style.overflow = prevBodyStyle.overflow;
        };
    }, []);

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
            <div style={{ height: '100%', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            overflow: 'hidden',
        }}>
            {/* ── Header — Instagram style ───────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px 10px 4px',
                background: '#000',
                flexShrink: 0,
            }}>
                {/* Back arrow */}
                <button onClick={() => navigate(-1)} style={{
                    color: '#fff', background: 'none', border: 'none',
                    padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}>
                    <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        background: '#3a3a3a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: 16,
                    }}>
                        {otherName[0]?.toUpperCase()}
                    </div>
                    {isOtherOnline && (
                        <span style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 12, height: 12, borderRadius: '50%',
                            background: '#3bc753', border: '2px solid #000',
                        }} />
                    )}
                </div>

                {/* Name + status */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2, letterSpacing: '-0.1px' }}>
                        {otherName}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>
                        {isOtherOnline ? 'Active now' : 'Offline'}
                    </div>
                </div>

                {/* Right: wallet */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {walletBalance !== null && (
                        <button onClick={() => setShowWallet(true)} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                        }}>
                            <span>💳</span><span>₹{walletBalance}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Thin separator */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

            {/* ── Messages ──────────────────────────────────────────────────────── */}
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

            {/* ── Input bar — Instagram style ─────────────────────────────────── */}
            <div style={{
                background: '#000',
                padding: '8px 12px 10px',
                display: 'flex', alignItems: 'center', gap: 10,
                flexShrink: 0,
            }}>
                {/* Gift button — left (acts like Instagram's camera) */}
                <button onClick={() => setShowGifts(true)} style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(45deg,#833ab4,#fd1d1d,#fcb045)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer', fontSize: 18,
                }}>
                    🎁
                </button>

                {/* Pill input area */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    background: 'transparent',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    borderRadius: 24, padding: '8px 14px',
                    minHeight: 42,
                }}>
                    <textarea
                        value={text}
                        onChange={handleTyping}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Message..."
                        rows={1}
                        style={{
                            flex: 1, background: 'transparent', color: '#fff',
                            fontSize: 14, resize: 'none', outline: 'none', border: 'none',
                            maxHeight: 80, overflowY: 'auto', lineHeight: 1.4,
                            '::placeholder': { color: 'rgba(255,255,255,0.4)' },
                        }}
                    />
                </div>

                {/* Right icons — show send icon if typing, else mic+image+emoji */}
                {text.trim() ? (
                    <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={handleSend}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#3897f0', fontWeight: 700, fontSize: 14, flexShrink: 0,
                            padding: '4px 2px',
                        }}
                    >
                        Send
                    </motion.button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        {/* Mic */}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex' }}>
                            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="9" y="2" width="6" height="12" rx="3" strokeWidth={1.8} />
                                <path strokeLinecap="round" strokeWidth={1.8} d="M5 10a7 7 0 0014 0M12 19v3M8 22h8" />
                            </svg>
                        </button>
                        {/* Image */}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex' }}>
                            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.8} />
                                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                <path strokeLinecap="round" strokeWidth={1.8} d="M21 15l-5-5L5 21" />
                            </svg>
                        </button>
                        {/* Sticker/emoji */}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex' }}>
                            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                                <path strokeLinecap="round" strokeWidth={1.8} d="M8 13s1.5 2 4 2 4-2 4-2" />
                                <circle cx="9" cy="10" r="1" fill="currentColor" />
                                <circle cx="15" cy="10" r="1" fill="currentColor" />
                            </svg>
                        </button>
                    </div>
                )}
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
