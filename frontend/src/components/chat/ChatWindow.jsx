import { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './chat.css';

/**
 * ChatWindow — premium message list.
 * Props:
 *   messages       – array of message objects
 *   currentUserId  – the logged-in user's _id
 *   otherName      – display name of the other participant
 *   otherAvatar    – (optional) profile photo URL of the other participant
 *   isTyping       – boolean
 *   onScrollTop    – called when user scrolls to top (load more)
 */
export default function ChatWindow({ messages, currentUserId, otherName, otherAvatar, isTyping, onScrollTop }) {
    const bottomRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    /* ── Date helpers ─────────────────────────────────────────────────────── */
    const isNewDay = (msg, prevMsg) => {
        if (!prevMsg) return true;
        return new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
    };

    const shouldGroup = (msg, prevMsg) => {
        if (!msg || !prevMsg) return false;
        const sid = (m) => {
            const s = m.senderId;
            if (!s) return '';
            if (typeof s === 'object' && s._id) return s._id.toString();
            return s.toString();
        };
        if (sid(msg) !== sid(prevMsg)) return false;
        return new Date(msg.createdAt) - new Date(prevMsg.createdAt) < 10 * 60 * 1000;
    };

    const getDayLabel = (date) => {
        const d = new Date(date);
        const dStr = d.toDateString();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (dStr === today) return 'Today';
        if (dStr === yesterday) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (date) =>
        new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const handleScroll = (e) => {
        if (e.target.scrollTop === 0) onScrollTop?.();
    };

    /* ── Empty state ─────────────────────────────────────────────────────── */
    if (messages.length === 0 && !isTyping) {
        return (
            <div className="chat-empty">
                <div className="chat-empty-icon">💬</div>
                <div className="chat-empty-title">Start the conversation</div>
                <div className="chat-empty-subtitle">
                    Say hello and break the ice! Your messages are private and secure.
                </div>
            </div>
        );
    }

    // ── Avatar helper: renders photo if available, else initial letter ──
    const AvatarCircle = ({ size = 'msg' }) => (
        <div className="chat-msg-avatar">
            {otherAvatar ? (
                <img src={otherAvatar} alt={otherName} />
            ) : (
                <span>{otherName?.[0]?.toUpperCase()}</span>
            )}
        </div>
    );

    return (
        <div ref={containerRef} className="chat-messages" onScroll={handleScroll}>
            {/* Spacer to push messages toward the bottom initially */}
            <div style={{ flexGrow: 1 }} />

            {messages.map((msg, i) => {
                const getSenderId = (m) => {
                    const s = m.senderId;
                    if (!s) return '';
                    if (typeof s === 'object' && s._id) return s._id.toString();
                    return s.toString();
                };

                const isMine = getSenderId(msg) === currentUserId?.toString();
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];

                const showDaySep   = isNewDay(msg, prevMsg);
                const groupedWithPrev = shouldGroup(msg, prevMsg);
                const groupedWithNext = shouldGroup(nextMsg, msg);

                const isFirst  = !groupedWithPrev;
                const isLast   = !groupedWithNext;

                // Shape: single / first / middle / last
                let shapeKey = 'single';
                if (!isFirst && !isLast) shapeKey = 'middle';
                else if (isFirst && !isLast) shapeKey = 'first';
                else if (!isFirst && isLast)  shapeKey = 'last';

                // Only show avatar on last message in a received group
                const showAvatar = !isMine && isLast;

                // Row gap class
                const gapClass = isFirst ? 'chat-msg-row--gap' : 'chat-msg-row--continued';

                return (
                    <div key={msg._id || i}>
                        {showDaySep && (
                            <div className="chat-day-separator">
                                <span>{getDayLabel(msg.createdAt)}</span>
                            </div>
                        )}
                        <MessageBubble
                            msg={msg}
                            isMine={isMine}
                            shapeKey={shapeKey}
                            showAvatar={showAvatar}
                            gapClass={gapClass}
                            otherName={otherName}
                            otherAvatar={otherAvatar}
                            formatTime={formatTime}
                        />
                    </div>
                );
            })}

            {/* ── Typing indicator ── */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.2 }}
                        className="chat-typing"
                    >
                        <div className="chat-msg-avatar-slot">
                            <div className="chat-msg-avatar">
                                {otherAvatar
                                    ? <img src={otherAvatar} alt={otherName} />
                                    : <span>{otherName?.[0]?.toUpperCase()}</span>
                                }
                            </div>
                        </div>
                        <div className="chat-typing-bubble">
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div ref={bottomRef} />
        </div>
    );
}

/* ── Read receipt tick SVG ──────────────────────────────────────────────────── */
function ReadTick({ seen }) {
    return (
        <span className={`chat-tick ${seen ? 'chat-tick--seen' : ''}`}>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                <path d="M1 5.5L4.5 9L11 2"
                    stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 5.5L8.5 9L15 2"
                    stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round"
                    opacity={seen ? 1 : 0.3} />
            </svg>
        </span>
    );
}

/* ── Avatar element ─────────────────────────────────────────────────────────── */
function AvatarImg({ name, photoUrl }) {
    return (
        <div className="chat-msg-avatar">
            {photoUrl
                ? <img src={photoUrl} alt={name} />
                : <span>{name?.[0]?.toUpperCase()}</span>
            }
        </div>
    );
}

/* ── Message Bubble ────────────────────────────────────────────────────────── */
const MessageBubble = memo(function MessageBubble({
    msg, isMine, shapeKey, showAvatar, gapClass, otherName, otherAvatar, formatTime
}) {
    const time = formatTime(msg.createdAt);

    /* ── Gift bubble ── */
    if (msg.type === 'gift') {
        return (
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 16 }}
                className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} chat-msg-row--gap`}
            >
                {/* No avatar for gift — center-aligned feel */}
                {!isMine && <div className="chat-msg-avatar-slot" />}
                <div className="chat-gift-bubble">
                    <span className="chat-gift-emoji">🎁</span>
                    <div className="chat-gift-amount">₹{msg.giftAmount?.toLocaleString('en-IN')}</div>
                    <span className="chat-gift-time">{time}</span>
                </div>
            </motion.div>
        );
    }

    /* ── Image bubble ── */
    if (msg.type === 'image') {
        const isUploading = String(msg._id).startsWith('opt-img-');
        return (
            <div className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} ${gapClass}`}>
                {/* Avatar slot for received images */}
                {!isMine && (
                    <div className="chat-msg-avatar-slot">
                        {showAvatar && <AvatarImg name={otherName} photoUrl={otherAvatar} />}
                    </div>
                )}
                <div className={`chat-image-bubble${isUploading ? ' chat-image-bubble--uploading' : ''}`}>
                    <img src={msg.content} alt="shared" loading="lazy" />
                </div>
            </div>
        );
    }

    /* ── Text bubble ── */
    const bubbleSideClass = isMine ? 'chat-bubble--sent' : 'chat-bubble--received';
    const bubbleShapeClass = `chat-bubble--${shapeKey}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} ${gapClass}`}
        >
            {/* Avatar slot — only on received side */}
            {!isMine && (
                <div className="chat-msg-avatar-slot">
                    {showAvatar && <AvatarImg name={otherName} photoUrl={otherAvatar} />}
                </div>
            )}

            {/* Bubble */}
            <div className={`chat-bubble ${bubbleSideClass} ${bubbleShapeClass}`}>
                <span>{msg.content}</span>
                <div className="chat-bubble-meta">
                    <span className="chat-bubble-time">{time}</span>
                    {isMine && <ReadTick seen={msg.seen} />}
                </div>
            </div>
        </motion.div>
    );
});
