import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import chatService, { connectSocket, getSocket } from '../services/chatService';
import ChatWindow from '../components/chat/ChatWindow';
import GiftPanel from '../components/chat/GiftPanel';
import WalletRechargeModal from '../components/WalletRechargeModal';
import api from '../services/api';
import '../components/chat/chat.css';

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
    const textareaRef = useRef(null);

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

    // ── Load room info (otherName) ──────────────────────────────────────────────
    useEffect(() => {
        const findRoom = (rooms) =>
            rooms.find(r => String(r._id) === String(chatId));

        chatService.getUserRooms()
            .then(({ data }) => {
                const room = findRoom(data?.data ?? []);
                if (room?.creatorProfile?.displayName) {
                    setOtherName(room.creatorProfile.displayName);
                } else if (room?.userId?.name) {
                    setOtherName(room.userId.name);
                }
            })
            .catch(() => {
                // If user-side rooms fail, try creator-side (when a creator opens a chat)
                chatService.getCreatorRooms()
                    .then(({ data }) => {
                        const room = findRoom(data?.data ?? []);
                        if (room?.userId?.name) setOtherName(room.userId.name);
                    })
                    .catch(() => { });
            });
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
                // Robust senderId string extraction
                const getSid = (v) => {
                    if (!v) return '';
                    if (typeof v === 'object' && v._id) return v._id.toString();
                    return v.toString();
                };
                const optimisticIdx = prev.findIndex(
                    (m) =>
                        m._id?.toString().startsWith('opt-') &&
                        getSid(m.senderId) === getSid(msg.senderId) &&
                        m.content === msg.content
                );
                if (optimisticIdx !== -1) {
                    const updated = [...prev];
                    updated[optimisticIdx] = msg;
                    return updated;
                }
                // Deduplicate: skip if exact _id already exists
                if (prev.some(m => m._id && msg._id && m._id.toString() === msg._id.toString())) {
                    return prev;
                }
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
            setIsOtherOnline(online);
        });

        return () => {
            socket.off('new_message');
            socket.off('typing');
            socket.off('user_online');
        };
    }, [chatId]);

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const socket = getSocket();
        socket?.emit('send_message', { chatId, type: 'text', content: trimmed });

        // Optimistic UI — senderId must be a plain string to match currentUserId comparison
        setMessages(prev => [...prev, {
            _id: `opt-${Date.now()}`,
            senderId: user._id?.toString(),
            type: 'text',
            content: trimmed,
            createdAt: new Date().toISOString(),
            seen: false,
        }]);

        setText('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, chatId, user._id]);

    // ── Typing indicator ───────────────────────────────────────────────────────
    const handleTyping = useCallback((e) => {
        setText(e.target.value);
        // Auto-expand textarea
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';

        const socket = getSocket();
        socket?.emit('typing', { chatId, isTyping: true });
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            socket?.emit('typing', { chatId, isTyping: false });
        }, 1500);
    }, [chatId]);

    const handleGiftSent = useCallback((msg) => {
        setMessages(prev => [...prev, msg]);
    }, []);

    const handleScrollTop = useCallback(() => {
        setPage(p => {
            const next = p + 1;
            loadMessages(next);
            return next;
        });
    }, [loadMessages]);

    if (loading) {
        return (
            <div className="chat-loading">
                <div className="chat-spinner" />
                <span className="chat-loading-text">Loading messages…</span>
            </div>
        );
    }

    return (
        <div className="chat-container">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="chat-header">
                {/* Back arrow */}
                <button onClick={() => navigate(-1)} className="chat-header-back" aria-label="Go back">
                    <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Avatar */}
                <div className="chat-header-avatar">
                    <div className="chat-header-avatar-circle">
                        {otherName[0]?.toUpperCase()}
                    </div>
                    {isOtherOnline && <span className="chat-header-online-dot" />}
                </div>

                {/* Name + status */}
                <div className="chat-header-info">
                    <div className="chat-header-name">{otherName}</div>
                    <div className={`chat-header-status ${isOtherOnline ? 'chat-header-status--online' : 'chat-header-status--offline'}`}>
                        {isOtherOnline ? 'Active now' : 'Offline'}
                    </div>
                </div>

                {/* Right: wallet */}
                <div className="chat-header-actions">
                    {walletBalance !== null && (
                        <button onClick={() => setShowWallet(true)} className="chat-wallet-btn">
                            <span>💳</span><span>₹{walletBalance}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Messages ──────────────────────────────────────────────────── */}
            <ChatWindow
                messages={messages}
                currentUserId={user?._id}
                otherName={otherName}
                isTyping={isTyping}
                onScrollTop={handleScrollTop}
            />

            {/* ── Input bar ─────────────────────────────────────────────────── */}
            <div className="chat-input-bar">
                {/* Gift button */}
                <button onClick={() => setShowGifts(true)} className="chat-gift-trigger" aria-label="Send a gift">
                    🎁
                </button>

                {/* Pill input area */}
                <div className="chat-input-field-wrap">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTyping}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Type a message…"
                        rows={1}
                        className="chat-input-textarea"
                    />
                </div>

                {/* Right: send button or action icons */}
                <AnimatePresence mode="wait">
                    {text.trim() ? (
                        <motion.button
                            key="send"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                            onClick={handleSend}
                            className="chat-send-btn"
                            aria-label="Send message"
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="#fff" />
                            </svg>
                        </motion.button>
                    ) : (
                        <motion.div
                            key="actions"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                            className="chat-action-icons"
                        >
                            {/* Mic */}
                            <button className="chat-action-icon" aria-label="Voice note">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="9" y="2" width="6" height="12" rx="3" strokeWidth={1.8} />
                                    <path strokeLinecap="round" strokeWidth={1.8} d="M5 10a7 7 0 0014 0M12 19v3M8 22h8" />
                                </svg>
                            </button>
                            {/* Image */}
                            <button className="chat-action-icon" aria-label="Send image">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.8} />
                                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                    <path strokeLinecap="round" strokeWidth={1.8} d="M21 15l-5-5L5 21" />
                                </svg>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Gift panel ───────────────────────────────────────────────── */}
            {showGifts && (
                <GiftPanel
                    chatId={chatId}
                    creatorName={otherName}
                    onGiftSent={handleGiftSent}
                    onClose={() => setShowGifts(false)}
                />
            )}

            {/* ── Wallet Recharge Modal ────────────────────────────────────── */}
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
