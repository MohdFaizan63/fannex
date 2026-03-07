import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChatWindow — Instagram DM style message list.
 */
export default function ChatWindow({ messages, currentUserId, otherName, isTyping, onScrollTop }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Group messages to show timestamp between groups > 10 minutes apart
    const shouldShowTimestamp = (msg, prevMsg) => {
        if (!prevMsg) return true;
        const diff = new Date(msg.createdAt) - new Date(prevMsg.createdAt);
        return diff > 10 * 60 * 1000; // 10 minutes
    };

    const formatTimestamp = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
            ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px 0 4px' }}
            onScroll={(e) => { if (e.target.scrollTop === 0) onScrollTop?.(); }}
        >
            {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId || msg.senderId?._id === currentUserId;
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const prevIsSame = prevMsg && (prevMsg.senderId === msg.senderId || prevMsg.senderId?._id === msg.senderId?._id);
                const nextIsSame = nextMsg && (nextMsg.senderId === msg.senderId || nextMsg.senderId?._id === msg.senderId?._id);
                const showTime = shouldShowTimestamp(msg, prevMsg);
                const isLast = !nextIsSame;

                return (
                    <div key={msg._id || i}>
                        {/* Centered timestamp */}
                        {showTime && (
                            <div style={{ textAlign: 'center', margin: '12px 0 6px', color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>
                                {formatTimestamp(msg.createdAt)}
                            </div>
                        )}
                        <MessageBubble
                            msg={msg}
                            isMine={isMine}
                            otherName={otherName}
                            showAvatar={!isMine && isLast}
                            prevIsSame={prevIsSame}
                        />
                    </div>
                );
            })}

            {/* Typing indicator — Instagram dots style */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '2px 16px 4px' }}
                    >
                        {/* Avatar */}
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#3a3a3a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                            {otherName?.[0]?.toUpperCase()}
                        </div>
                        {/* Dots bubble */}
                        <div style={{
                            background: '#262626', borderRadius: 22,
                            padding: '12px 16px',
                            display: 'flex', gap: 4, alignItems: 'center',
                        }}>
                            {[0, 1, 2].map(dot => (
                                <span key={dot} style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.5)',
                                    display: 'inline-block',
                                    animation: 'bounceDot 1.2s infinite',
                                    animationDelay: `${dot * 0.2}s`,
                                }} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div ref={bottomRef} />

            <style>{`
                @keyframes bounceDot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
                    30% { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function MessageBubble({ msg, isMine, otherName, showAvatar, prevIsSame }) {
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mt = prevIsSame ? 2 : 8;

    // Gift bubble
    if (msg.type === 'gift') {
        return (
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 16 }}
                style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', margin: `${mt}px 16px` }}
            >
                <div style={{
                    borderRadius: 20, overflow: 'hidden', maxWidth: 200,
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(236,72,153,0.2))',
                    border: '1px solid rgba(124,58,237,0.3)',
                }}>
                    <div style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 6 }}>🎁</div>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>₹{msg.giftAmount?.toLocaleString('en-IN')}</div>
                        <div style={{ color: 'rgba(196,148,255,0.9)', fontSize: 11, marginTop: 2 }}>Gift sent</div>
                    </div>
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: 10, paddingBottom: 8 }}>{time}</div>
                </div>
            </motion.div>
        );
    }

    // — Tail shape logic (Instagram style: rounded except corner near avatar/tail) —
    // Sent (right): all rounded, slightly less rounded at bottom-right
    // Received (left): all rounded, slightly less rounded at bottom-left

    const sentBg = 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)'; // Instagram gradient for sent
    const receivedBg = '#262626';

    const sentRadius = prevIsSame ? '18px' : '18px 18px 4px 18px';
    const receivedRadius = prevIsSame ? '18px' : '18px 18px 18px 4px';

    // Image message
    if (msg.type === 'image') {
        return (
            <div style={{
                display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 6, margin: `${mt}px 12px`,
            }}>
                {/* Spacer / avatar */}
                <div style={{ width: 28, flexShrink: 0 }}>
                    {showAvatar && (
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#3a3a3a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                        }}>
                            {otherName?.[0]?.toUpperCase()}
                        </div>
                    )}
                </div>
                <div style={{
                    borderRadius: 16, overflow: 'hidden',
                    maxWidth: 220,
                }}>
                    <img src={msg.content} alt="shared" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            style={{
                display: 'flex',
                flexDirection: isMine ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 6,
                margin: `${mt}px 12px`,
            }}
        >
            {/* Avatar (received only, last in group) */}
            <div style={{ width: 28, flexShrink: 0 }}>
                {!isMine && showAvatar && (
                    <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: '#3a3a3a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>
                        {otherName?.[0]?.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Bubble */}
            <div style={{
                maxWidth: '72%',
                padding: '10px 14px',
                borderRadius: isMine ? sentRadius : receivedRadius,
                background: isMine ? sentBg : receivedBg,
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.45,
                wordBreak: 'break-word',
                boxShadow: isMine ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}>
                {msg.content}
            </div>
        </motion.div>
    );
}
