import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    // ── State ──────────────────────────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [otherName, setOtherName] = useState('Creator');
    const [otherAvatar, setOtherAvatar] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherOnline, setIsOtherOnline] = useState(false);
    const [text, setText] = useState('');
    const [showGifts, setShowGifts] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);
    const [messagePrice, setMessagePrice] = useState(0);
    const [page, setPage] = useState(1);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState(''); // transient upload error toast

    // Insufficient balance modal
    const [showInsufficientModal, setShowInsufficientModal] = useState(false);

    // Deduction toast: { amount, newBalance, visible }
    const [deductionToast, setDeductionToast] = useState(null);
    const toastTimeoutRef = useRef(null);

    // Refs
    const typingTimeout = useRef(null);
    const socketRef = useRef(null);
    const textareaRef = useRef(null);
    const imageInputRef = useRef(null);
    // Track image IDs that WE uploaded — prevents socket broadcast from doubling them
    const uploadedImageIdsRef = useRef(new Set());

    // Is this user the creator in the room — derived directly from user.role (reliable, immediate)
    const isCreator = user?.role === 'creator';
    const isCreatorRef = useRef(isCreator); // keep ref for non-reactive callbacks
    useEffect(() => { isCreatorRef.current = isCreator; }, [isCreator]);

    // ── Lock body on Android Chrome ────────────────────────────────────────────
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const prevHtml = { height: html.style.height, overflow: html.style.overflow };
        const prevBody = { height: body.style.height, overflow: body.style.overflow };
        html.style.height = '100%'; html.style.overflow = 'hidden';
        body.style.height = '100%'; body.style.overflow = 'hidden';
        return () => {
            html.style.height = prevHtml.height; html.style.overflow = prevHtml.overflow;
            body.style.height = prevBody.height; body.style.overflow = prevBody.overflow;
        };
    }, []);

    // ── Load chat info (messagePrice + walletBalance) ──────────────────────────
    useEffect(() => {
        api.get(`/chat/rooms/${chatId}/info`)
            .then(r => {
                const { messagePrice: mp, walletBalance: wb } = r.data.data;
                setMessagePrice(mp ?? 0);
                setWalletBalance(wb ?? 0);
            })
            .catch(() => {
                // Fallback: fetch wallet balance separately
                api.get('/payment/wallet-balance')
                    .then(r => setWalletBalance(r.data.data.walletBalance))
                    .catch(() => { });
            });
    }, [chatId]);

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

    // ── Load room info (otherName + detect if current user is the creator) ─────
    useEffect(() => {
        const findRoom = (rooms) => rooms.find(r => String(r._id) === String(chatId));

        if (isCreator) {
            // Creator: look up fan's name + avatar from creator rooms
            chatService.getCreatorRooms()
                .then(({ data }) => {
                    const room = findRoom(data?.data ?? []);
                    if (room?.userId?.name) setOtherName(room.userId.name);
                    // User model has no photo — graceful fallback to letter avatar
                })
                .catch(() => { });
        } else {
            // Fan: look up creator name + avatar from user rooms
            chatService.getUserRooms()
                .then(({ data }) => {
                    const room = findRoom(data?.data ?? []);
                    const displayName = room?.creatorProfile?.displayName || room?.userId?.name;
                    // CreatorProfile stores photo as 'profileImage'
                    const avatar = room?.creatorProfile?.profileImage || '';
                    if (displayName) setOtherName(displayName);
                    if (avatar)      setOtherAvatar(avatar);
                })
                .catch(() => { });
        }
    }, [chatId, isCreator]);

    useEffect(() => { loadMessages(1); }, [loadMessages]);

    // ── Refresh trigger: ?refresh=1 from gift success page ─────────────────────
    // When user taps "Back to Chat" on the gift success page, we reload messages
    // so the newly created gift bubble appears immediately.
    useEffect(() => {
        if (searchParams.get('refresh') === '1') {
            loadMessages(1);
            // Clean the param from URL so it doesn't re-trigger on forward/back nav
            navigate(`/chat/${chatId}`, { replace: true });
        }
    }, [searchParams, chatId, loadMessages, navigate]);

    // ── Socket.io ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('fannex_token');
        const socket = connectSocket(token);
        socketRef.current = socket;

        socket.emit('join_room', { chatId });
        socket.emit('mark_seen', { chatId });

        socket.on('new_message', (msg) => {
            setMessages(prev => {
                const msgId = msg._id?.toString();
                // 1. Skip exact _id duplicate (text dedup)
                if (msgId && prev.some(m => m._id?.toString() === msgId)) return prev;
                // 2. Skip if we registered this ID from upload response
                if (msgId && uploadedImageIdsRef.current.has(msgId)) {
                    uploadedImageIdsRef.current.delete(msgId);
                    return prev;
                }
                // 3. Image race-condition fix: if an optimistic image bubble exists,
                //    replace it in-place so we never get two image bubbles.
                if (msg.type === 'image') {
                    const optIdx = prev.findIndex(m => String(m._id).startsWith('opt-img-') && m.type === 'image');
                    if (optIdx !== -1) {
                        const updated = [...prev];
                        updated[optIdx] = { ...msg };
                        return updated;
                    }
                }
                return [...prev, msg];
            });
            socket.emit('mark_seen', { chatId });
        });

        socket.on('messages_seen', () => {
            setMessages(prev => prev.map(m =>
                m.senderId?.toString() !== user?._id?.toString() ? m : { ...m, seen: true }
            ));
        });

        socket.on('typing', ({ isTyping: t }) => {
            setIsTyping(t);
            if (t) {
                clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
            }
        });

        socket.on('user_online', ({ userId, online }) => { setIsOtherOnline(online); });

        // ── Wallet deducted event: update balance + show toast ─────────────────
        socket.on('wallet_deducted', ({ deducted, newBalance }) => {
            setWalletBalance(newBalance);
            clearTimeout(toastTimeoutRef.current);
            setDeductionToast({ amount: deducted, newBalance, visible: true });
            toastTimeoutRef.current = setTimeout(() => setDeductionToast(null), 2500);
        });

        // ── Send error (insufficient balance) ──────────────────────────────────
        socket.on('send_error', ({ code }) => {
            if (code === 'INSUFFICIENT_BALANCE') {
                // Remove the optimistic message that was added
                setMessages(prev => prev.filter(m => !String(m._id).startsWith('opt-')));
                setShowInsufficientModal(true);
            }
        });

        return () => {
            socket.off('new_message');
            socket.off('typing');
            socket.off('user_online');
            socket.off('wallet_deducted');
            socket.off('send_error');
            socket.off('messages_seen');
        };
    }, [chatId]);

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed) return;

        // Client-side pre-send balance check (only for fans, not creators)
        if (!isCreatorRef.current && !isCreator && messagePrice > 0 && walletBalance !== null && walletBalance < messagePrice) {
            setShowInsufficientModal(true);
            return;
        }

        const socket = getSocket();
        socket?.emit('send_message', { chatId, type: 'text', content: trimmed });

        // Optimistic UI
        setMessages(prev => [...prev, {
            _id: `opt-${Date.now()}`,
            senderId: user._id?.toString(),
            type: 'text',
            content: trimmed,
            createdAt: new Date().toISOString(),
            seen: false,
        }]);

        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [text, chatId, user._id, messagePrice, walletBalance]);

    // ── Typing indicator ───────────────────────────────────────────────────────
    const handleTyping = useCallback((e) => {
        setText(e.target.value);
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

    // ── Image upload ───────────────────────────────────────────────────────────
    const handleImageUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        // 7 MB limit
        const MAX_CHAT_IMAGE_MB = 7;
        if (file.size > MAX_CHAT_IMAGE_MB * 1024 * 1024) {
            setUploadError(`Image must be under ${MAX_CHAT_IMAGE_MB}MB. Please choose a smaller photo.`);
            setTimeout(() => setUploadError(''), 4000);
            return;
        }

        const localUrl = URL.createObjectURL(file);
        const optimisticId = `opt-img-${Date.now()}`;
        setMessages(prev => [...prev, {
            _id: optimisticId,
            senderId: user._id?.toString(),
            type: 'image',
            content: localUrl,
            createdAt: new Date().toISOString(),
            seen: false,
        }]);

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const { data: json } = await api.post(
                `/chat/rooms/${chatId}/upload-image`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            if (json.success) {
                const realId = json.data._id?.toString();
                // Register the real ID so the socket new_message event doesn't duplicate it
                if (realId) uploadedImageIdsRef.current.add(realId);
                setMessages(prev => prev.map(m => m._id === optimisticId ? { ...json.data } : m));
            } else {
                setMessages(prev => prev.filter(m => m._id !== optimisticId));
            }
        } catch (err) {
            console.error('Image upload failed:', err);
            setMessages(prev => prev.filter(m => m._id !== optimisticId));
        } finally {
            setUploadingImage(false);
            URL.revokeObjectURL(localUrl);
        }
    }, [chatId, user._id]);

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
                        {otherAvatar
                            ? <img src={otherAvatar} alt={otherName} />
                            : otherName[0]?.toUpperCase()
                        }
                    </div>
                    {isOtherOnline && <span className="chat-header-online-dot" />}
                </div>

                {/* Name + status + message price */}
                <div className="chat-header-info">
                    <div className="chat-header-name">{otherName}</div>
                    <div className="chat-header-meta">
                        <span className={`chat-header-status ${isOtherOnline ? 'chat-header-status--online' : 'chat-header-status--offline'}`}>
                            {isOtherOnline ? 'Active now' : 'Offline'}
                        </span>
                        {messagePrice > 0 && !isCreatorRef.current && (
                            <span className="chat-msg-price">₹{messagePrice}/msg</span>
                        )}
                    </div>
                </div>

                {/* Right: wallet balance + recharge (hidden for creators) */}
                <div className="chat-header-actions">
                    {walletBalance !== null && !isCreator && (
                        <button onClick={() => setShowWallet(true)} className="chat-wallet-btn">
                            <span>💳</span>
                            <span>₹{Math.round(walletBalance)}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Messages ──────────────────────────────────────────────────── */}
            <ChatWindow
                messages={messages}
                currentUserId={user?._id}
                otherName={otherName}
                otherAvatar={otherAvatar}
                isTyping={isTyping}
                onScrollTop={handleScrollTop}
            />

            {/* ── Deduction Toast ───────────────────────────────────────────── */}
            <AnimatePresence>
                {deductionToast && (
                    <motion.div
                        key="toast"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="chat-deduction-toast"
                    >
                        <span className="chat-deduction-toast__icon">💸</span>
                        <span>₹{Math.round(deductionToast.amount)} deducted · Balance: ₹{Math.round(deductionToast.newBalance)}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Upload Error Toast ────────────────────────────────────────── */}
            <AnimatePresence>
                {uploadError && (
                    <motion.div
                        key="upload-error"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="chat-deduction-toast"
                        style={{ background: 'rgba(239,68,68,0.92)', borderColor: 'rgba(239,68,68,0.6)' }}
                    >
                        <span>⚠️</span>
                        <span>{uploadError}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Input bar ─────────────────────────────────────────────────── */}
            <div className="chat-input-bar">
                {/* Gift button — hidden for creators */}
                {!isCreator && (
                    <button onClick={() => setShowGifts(true)} className="chat-gift-trigger" aria-label="Send a gift">
                        🎁
                    </button>
                )}

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
                            {/* Hidden file input */}
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleImageUpload}
                            />
                            {/* Image picker button */}
                            <button
                                className="chat-action-icon"
                                aria-label="Send image"
                                onClick={() => {
                                    // Check wallet balance before opening file picker (fans only, not creators)
                                    if (!isCreator && messagePrice > 0 && walletBalance !== null && walletBalance < messagePrice) {
                                        setShowInsufficientModal(true);
                                        return;
                                    }
                                    imageInputRef.current?.click();
                                }}
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle
                                            cx="12" cy="12" r="9"
                                            stroke="currentColor" strokeWidth="2"
                                            strokeDasharray="28" strokeDashoffset="10"
                                            style={{ animation: 'chatSpin 0.8s linear infinite', transformOrigin: 'center' }}
                                        />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.8} />
                                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                        <path strokeLinecap="round" strokeWidth={1.8} d="M21 15l-5-5L5 21" />
                                    </svg>
                                )}
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
                    sourceChatId={chatId}
                />
            )}

            {/* ── Insufficient Balance Modal ───────────────────────────────── */}
            <AnimatePresence>
                {showInsufficientModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="chat-insufficient-overlay"
                        onClick={() => setShowInsufficientModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.88, y: 24 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.88, y: 24 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                            className="chat-insufficient-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="chat-insufficient-icon">💸</div>
                            <h3 className="chat-insufficient-title">Insufficient Balance</h3>
                            <p className="chat-insufficient-body">
                                You need <strong>₹{messagePrice}</strong> to send a message.<br />
                                Current balance: <strong>₹{Math.round(walletBalance ?? 0)}</strong>
                            </p>
                            <button
                                className="chat-insufficient-btn"
                                onClick={() => { setShowInsufficientModal(false); setShowWallet(true); }}
                            >
                                Recharge Wallet
                            </button>
                            <button
                                className="chat-insufficient-cancel"
                                onClick={() => setShowInsufficientModal(false)}
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
