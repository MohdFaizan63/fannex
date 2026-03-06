import { useState, useRef, useEffect, useCallback } from 'react';
import postService from '../services/postService';

const EMOJIS = ['🔥', '❤️', '😍', '👏', '💯', '🎉', '😂', '🙌', '💪', '✨'];

function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}

/**
 * Single comment row
 */
function CommentRow({ comment, currentUserId, isCreator, onDelete, onHide, onReply }) {
    const isOwn = comment.userId?._id === currentUserId;
    const [showActions, setShowActions] = useState(false);

    return (
        <div className={`group py-2.5 ${comment.isHidden ? 'opacity-40' : ''}`}>
            <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {comment.userId?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                            {comment.userId?.name ?? 'User'}
                        </span>
                        <span className="text-[10px] text-surface-600">{timeAgo(comment.createdAt)}</span>
                        {comment.isHidden && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">hidden</span>
                        )}
                    </div>
                    <p className="text-sm text-surface-300 mt-0.5 break-words leading-relaxed">
                        {comment.commentText}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                        <button
                            onClick={() => onReply?.(comment)}
                            className="text-[10px] text-surface-500 hover:text-brand-400 transition-colors font-medium"
                        >
                            Reply
                        </button>
                        {(isOwn || isCreator) && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowActions(!showActions)}
                                    className="text-[10px] text-surface-600 hover:text-surface-400 transition-colors"
                                >
                                    •••
                                </button>
                                {showActions && (
                                    <div className="absolute left-0 top-4 z-20 glass rounded-lg border border-white/10 py-1 min-w-[100px] shadow-xl">
                                        {(isOwn || isCreator) && (
                                            <button
                                                onClick={() => { onDelete(comment._id); setShowActions(false); }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        )}
                                        {isCreator && !isOwn && (
                                            <button
                                                onClick={() => { onHide(comment._id); setShowActions(false); }}
                                                className="w-full text-left px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                                            >
                                                {comment.isHidden ? 'Unhide' : 'Hide'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Replies */}
            {comment.replies?.length > 0 && (
                <div className="ml-9 mt-1 border-l border-white/5 pl-3">
                    {comment.replies.map((reply) => (
                        <CommentRow
                            key={reply._id}
                            comment={reply}
                            currentUserId={currentUserId}
                            isCreator={isCreator}
                            onDelete={onDelete}
                            onHide={onHide}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * CommentSection — full comment thread with input, emoji picker, replies, and pagination.
 *
 * Props:
 *  postId       – post ObjectId
 *  creatorId    – creator's userId
 *  currentUser  – current auth user object (or null)
 *  isSubscribed – boolean
 *  onGate       – () => void  (show subscribe gate)
 *  compact      – boolean (smaller variant for lightbox)
 */
export default function CommentSection({ postId, creatorId, currentUser, isSubscribed, onGate, compact = false }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const inputRef = useRef(null);

    const isCreator = currentUser?._id === creatorId;

    // ── Load comments ──────────────────────────────────────────────────────────
    const fetchComments = useCallback(async (pg = 1, append = false) => {
        try {
            if (pg === 1) setLoading(true);
            else setLoadingMore(true);

            const { data } = await postService.getComments(postId, { page: pg, limit: 10 });
            const fetched = data.results ?? [];

            if (append) {
                setComments((prev) => [...prev, ...fetched]);
            } else {
                setComments(fetched);
            }
            setPage(pg);
            setHasMore(pg < data.totalPages);
        } catch (_) {
            /* silent */
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [postId]);

    useEffect(() => {
        fetchComments(1);
    }, [fetchComments]);

    // ── Submit comment ─────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!text.trim() || submitting) return;

        if (!isSubscribed) {
            onGate?.();
            return;
        }

        setSubmitting(true);
        try {
            const { data } = await postService.addComment(postId, {
                commentText: text.trim(),
                parentId: replyTo?._id || null,
            });

            if (replyTo) {
                // Add reply under parent
                setComments((prev) =>
                    prev.map((c) =>
                        c._id === replyTo._id
                            ? { ...c, replies: [...(c.replies || []), data.data] }
                            : c
                    )
                );
            } else {
                // Prepend new top-level comment
                setComments((prev) => [{ ...data.data, replies: [] }, ...prev]);
            }

            setText('');
            setReplyTo(null);
            setShowEmoji(false);
        } catch (err) {
            if (err.response?.data?.requiresSubscription) {
                onGate?.();
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete comment ─────────────────────────────────────────────────────────
    const handleDelete = async (commentId) => {
        try {
            await postService.deleteComment(commentId);
            // Remove from top-level or from replies
            setComments((prev) =>
                prev
                    .filter((c) => c._id !== commentId)
                    .map((c) => ({
                        ...c,
                        replies: (c.replies || []).filter((r) => r._id !== commentId),
                    }))
            );
        } catch (_) { /* silent */ }
    };

    // ── Hide comment ───────────────────────────────────────────────────────────
    const handleHide = async (commentId) => {
        try {
            const { data } = await postService.hideComment(commentId);
            const toggle = (c) =>
                c._id === commentId ? { ...c, isHidden: data.isHidden } : c;

            setComments((prev) =>
                prev.map((c) => ({
                    ...toggle(c),
                    replies: (c.replies || []).map(toggle),
                }))
            );
        } catch (_) { /* silent */ }
    };

    // ── Reply ──────────────────────────────────────────────────────────────────
    const handleReply = (comment) => {
        setReplyTo(comment);
        inputRef.current?.focus();
    };

    return (
        <div className={compact ? '' : 'mt-1'}>
            {/* Comment input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 border-t border-white/5">
                {replyTo && (
                    <div className="absolute -top-6 left-4 text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        Replying to {replyTo.userId?.name ?? 'user'}
                        <button onClick={() => setReplyTo(null)} className="text-surface-500 hover:text-white ml-1">✕</button>
                    </div>
                )}

                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={
                            !currentUser
                                ? 'Log in to comment'
                                : !isSubscribed
                                    ? 'Subscribe to comment...'
                                    : replyTo
                                        ? `Reply to ${replyTo.userId?.name ?? 'user'}...`
                                        : 'Add a comment...'
                        }
                        disabled={!currentUser}
                        onClick={() => { if (!isSubscribed && currentUser) onGate?.(); }}
                        className="w-full bg-surface-800/80 border border-white/5 rounded-full px-3 py-1.5 text-sm text-white placeholder:text-surface-600 focus:border-brand-500/50 focus:outline-none transition-colors"
                        maxLength={1000}
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmoji(!showEmoji)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 text-sm"
                    >
                        😊
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={!text.trim() || submitting || !currentUser}
                    className="text-brand-400 hover:text-brand-300 disabled:text-surface-600 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
                >
                    {submitting ? '...' : 'Post'}
                </button>
            </form>

            {/* Emoji picker */}
            {showEmoji && (
                <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-white/5">
                    {EMOJIS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => { setText((prev) => prev + e); setShowEmoji(false); inputRef.current?.focus(); }}
                            className="text-lg hover:scale-125 transition-transform p-1"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}

            {/* Reply indicator below input */}
            {replyTo && (
                <div className="px-4 py-1">
                    <span className="text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        ↳ Replying to {replyTo.userId?.name ?? 'user'}
                        <button onClick={() => setReplyTo(null)} className="text-surface-500 hover:text-white ml-0.5">✕</button>
                    </span>
                </div>
            )}

            {/* Comments list */}
            <div className={`px-4 ${compact ? 'max-h-60 overflow-y-auto' : ''}`}>
                {loading ? (
                    <div className="py-4 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-surface-600 text-xs text-center py-4">No comments yet. Be the first!</p>
                ) : (
                    <>
                        {comments.map((c) => (
                            <CommentRow
                                key={c._id}
                                comment={c}
                                currentUserId={currentUser?._id}
                                isCreator={isCreator}
                                onDelete={handleDelete}
                                onHide={handleHide}
                                onReply={handleReply}
                            />
                        ))}

                        {hasMore && (
                            <button
                                onClick={() => fetchComments(page + 1, true)}
                                disabled={loadingMore}
                                className="w-full py-2 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium text-center"
                            >
                                {loadingMore ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-3 h-3 border border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                                        Loading…
                                    </span>
                                ) : (
                                    'Load more comments'
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
