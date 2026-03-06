import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChatWindow — renders the scrollable message list in iMessage style.
 * - Right bubble: messages sent by currentUserId
 * - Left bubble: messages from the other party
 * - Gift messages: special 🎁 card
 */
export default function ChatWindow({ messages, currentUserId, otherName, isTyping, onScrollTop }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" onScroll={(e) => {
            if (e.target.scrollTop === 0) onScrollTop?.();
        }}>
            {messages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId || msg.senderId?._id === currentUserId;
                return (
                    <MessageBubble
                        key={msg._id || i}
                        msg={msg}
                        isMine={isMine}
                        otherName={otherName}
                        prevMsg={messages[i - 1]}
                    />
                );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-end gap-2"
                    >
                        <div className="w-7 h-7 rounded-full bg-violet-600/30 flex items-center justify-center text-xs flex-shrink-0">
                            {otherName?.[0]?.toUpperCase()}
                        </div>
                        <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                            {[0, 1, 2].map((dot) => (
                                <span
                                    key={dot}
                                    className="w-1.5 h-1.5 rounded-full bg-white/50 inline-block animate-bounce"
                                    style={{ animationDelay: `${dot * 0.15}s` }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div ref={bottomRef} />
        </div>
    );
}

function MessageBubble({ msg, isMine, otherName, prevMsg }) {
    const sameAuthor = prevMsg && (prevMsg.senderId === msg.senderId || prevMsg.senderId?._id === msg.senderId?._id);
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msg.type === 'gift') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-2`}
            >
                <div className="rounded-3xl overflow-hidden border border-violet-500/30 max-w-[220px] shadow-lg shadow-violet-500/20"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.2))' }}>
                    <div className="p-4 text-center">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5, 0] }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-4xl mb-2"
                        >🎁</motion.div>
                        <div className="text-white font-black text-xl">₹{msg.giftAmount?.toLocaleString('en-IN')}</div>
                        <div className="text-violet-300 text-xs mt-1 font-medium">Gift sent</div>
                    </div>
                    <div className="text-center text-white/30 text-[10px] pb-2">{time}</div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${sameAuthor ? 'mt-0.5' : 'mt-3'}`}
        >
            {/* Avatar — only for other party */}
            {!isMine && !sameAuthor ? (
                <div className="w-7 h-7 rounded-full bg-violet-600/40 flex-shrink-0 flex items-center justify-center text-xs text-white font-bold">
                    {otherName?.[0]?.toUpperCase()}
                </div>
            ) : <div className="w-7 flex-shrink-0" />}

            <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                {/* Image message */}
                {msg.type === 'image' ? (
                    <div className={`rounded-2xl overflow-hidden ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                        <img src={msg.content} alt="shared" className="max-w-xs max-h-60 object-cover" />
                    </div>
                ) : (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine
                        ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-br-sm'
                        : 'bg-white/8 border border-white/10 text-white rounded-bl-sm'
                        }`}>
                        {msg.content}
                    </div>
                )}

                {/* Timestamp + seen */}
                <div className={`flex items-center gap-1 text-[10px] text-white/30 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span>{time}</span>
                    {isMine && (
                        <span className={msg.seen ? 'text-violet-400' : 'text-white/25'}>
                            {msg.seen ? '✓✓' : '✓'}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
