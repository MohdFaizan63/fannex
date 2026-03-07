import { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './chat.css';

/**
 * ChatWindow — Premium message list with grouped bubbles, day separators,
 * read receipts, and typing indicator.
 */
export default function ChatWindow({ messages, currentUserId, otherName, isTyping, onScrollTop }) {
    const bottomRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Group messages to show timestamp between groups > 10 minutes apart
    const shouldShowTimestamp = (msg, prevMsg) => {
        if (!prevMsg) return true;
        const diff = new Date(msg.createdAt) - new Date(prevMsg.createdAt);
        return diff > 10 * 60 * 1000;
    };

    const formatTimestamp = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleScroll = (e) => {
        if (e.target.scrollTop === 0) onScrollTop?.();
    };

    if (messages.length === 0 && !isTyping) {
        return (
            <div className="chat-empty">
                <div className="chat-empty-icon">💬</div>
                <div className="chat-empty-title">Start the conversation</div>
                <div className="chat-empty-subtitle">Say hello and break the ice! Your messages are private and secure.</div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="chat-messages"
            onScroll={handleScroll}
        >
            {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId || msg.senderId?._id === currentUserId;
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const prevIsSame = prevMsg && (prevMsg.senderId === msg.senderId || prevMsg.senderId?._id === msg.senderId?._id);
                const nextIsSame = nextMsg && (nextMsg.senderId === msg.senderId || nextMsg.senderId?._id === msg.senderId?._id);
                const showTime = shouldShowTimestamp(msg, prevMsg);
                const isLast = !nextIsSame;
                const isFirst = !prevIsSame;

                return (
                    <div key={msg._id || i}>
                        {/* Day separator */}
                        {showTime && (
                            <div className="chat-day-separator">
                                <span>{formatTimestamp(msg.createdAt)}</span>
                            </div>
                        )}
                        <MessageBubble
                            msg={msg}
                            isMine={isMine}
                            otherName={otherName}
                            showAvatar={!isMine && isLast}
                            isFirst={isFirst}
                            isLast={isLast}
                            isSingle={isFirst && isLast}
                            formatTime={formatTime}
                        />
                    </div>
                );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.2 }}
                        className="chat-typing"
                    >
                        {/* Avatar */}
                        <div className="chat-msg-avatar-slot">
                            <div className="chat-msg-avatar">
                                {otherName?.[0]?.toUpperCase()}
                            </div>
                        </div>
                        {/* Dots bubble */}
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
                <path
                    d="M1 5.5L4.5 9L11 2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M5 5.5L8.5 9L15 2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={seen ? 1 : 0.3}
                />
            </svg>
        </span>
    );
}

/* ── Message Bubble ────────────────────────────────────────────────────────── */
const MessageBubble = memo(function MessageBubble({ msg, isMine, otherName, showAvatar, isFirst, isLast, isSingle, formatTime }) {
    const time = formatTime(msg.createdAt);

    // Gift bubble
    if (msg.type === 'gift') {
        return (
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 16 }}
                className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} chat-msg-row--gap`}
            >
                <div className="chat-msg-avatar-slot" />
                <div className="chat-gift-bubble">
                    <div className="chat-gift-emoji">🎁</div>
                    <div className="chat-gift-amount">₹{msg.giftAmount?.toLocaleString('en-IN')}</div>
                    <div className="chat-gift-label">Gift sent</div>
                    <div className="chat-gift-time">{time}</div>
                </div>
            </motion.div>
        );
    }

    // Image message
    if (msg.type === 'image') {
        return (
            <div className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} ${!isFirst ? '' : 'chat-msg-row--gap'}`}>
                <div className="chat-msg-avatar-slot">
                    {showAvatar && (
                        <div className="chat-msg-avatar">
                            {otherName?.[0]?.toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="chat-image-bubble">
                    <img src={msg.content} alt="shared" loading="lazy" />
                </div>
            </div>
        );
    }

    // Determine bubble shape class
    let shapeClass = '';
    if (isSingle) shapeClass = 'chat-bubble--single';
    else if (isFirst) shapeClass = 'chat-bubble--first';
    else if (!isFirst && !isLast) shapeClass = 'chat-bubble--continued';
    // else: default radius (last in group)

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`chat-msg-row ${isMine ? 'chat-msg-row--sent' : ''} ${isFirst && !isSingle ? 'chat-msg-row--gap' : ''}`}
        >
            {/* Avatar (received only, last in group) */}
            <div className="chat-msg-avatar-slot">
                {!isMine && showAvatar && (
                    <div className="chat-msg-avatar">
                        {otherName?.[0]?.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Bubble */}
            <div className={`chat-bubble ${isMine ? 'chat-bubble--sent' : 'chat-bubble--received'} ${shapeClass}`}>
                <span>{msg.content}</span>
                <div className="chat-bubble-meta">
                    <span className="chat-bubble-time">{time}</span>
                    {isMine && <ReadTick seen={msg.seen} />}
                </div>
            </div>
        </motion.div>
    );
});
