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
            <div className="min-h-screen bg-[#080810] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080810] flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0a0a15]/80 backdrop-blur-md sticky top-16 z-10">
                <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white transition-colors p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-violet-600/40 flex items-center justify-center text-white font-bold text-sm">
                        {otherName[0]?.toUpperCase()}
                    </div>
                    {isOtherOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0a0a15]" />
                    )}
                </div>

                <div>
                    <div className="text-white font-semibold text-sm">{otherName}</div>
                    <div className="text-white/40 text-xs">{isOtherOnline ? '🟢 Online' : 'Offline'}</div>
                </div>

                {/* Wallet balance + top-up */}
                <div className="ml-auto flex items-center gap-2">
                    {walletBalance !== null && (
                        <button
                            onClick={() => setShowWallet(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                            title="Tap to recharge wallet"
                        >
                            <span>💳</span>
                            <span>₹{walletBalance}</span>
                        </button>
                    )}
                    {/* Gift button in header */}
                    <button
                        onClick={() => setShowGifts(true)}
                        className="text-xl hover:scale-110 transition-transform"
                        title="Send a gift"
                    >🎁</button>
                </div>
            </div>

            {/* ── Messages ────────────────────────────────────────────────────── */}
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

            {/* ── Input bar ───────────────────────────────────────────────────── */}
            <div className="border-t border-white/8 bg-[#0a0a15]/80 backdrop-blur-md px-4 py-3 flex items-end gap-3 sticky bottom-0">
                <button
                    onClick={() => setShowGifts(true)}
                    className="text-xl flex-shrink-0 mb-1 hover:scale-110 transition-transform"
                >🎁</button>

                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 min-h-[44px] max-h-[120px] flex items-center">
                    <textarea
                        value={text}
                        onChange={handleTyping}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Message..."
                        rows={1}
                        className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder:text-white/30 max-h-[80px] overflow-y-auto"
                    />
                </div>

                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className="w-10 h-10 flex-shrink-0 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                >
                    <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                    </svg>
                </motion.button>
            </div>

            {/* ── Gift panel ──────────────────────────────────────────────────── */}
            {showGifts && (
                <GiftPanel
                    chatId={chatId}
                    creatorName={otherName}
                    onGiftSent={handleGiftSent}
                    onClose={() => setShowGifts(false)}
                />
            )}

            {/* ── Wallet Recharge Modal ────────────────────────────────────────── */}
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
