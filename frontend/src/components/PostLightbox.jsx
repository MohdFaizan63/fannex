import { useEffect, useCallback, useRef, useState } from 'react';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import AlbumCarousel from './AlbumCarousel';

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * PostLightbox — full-screen media viewer with prev/next navigation + touch swipe
 *
 * Props:
 *  posts       – array of post objects  (optional — enables prev/next)
 *  currentIndex – index in `posts` array (optional)
 *  post        – single post object (used when no posts array)
 *  creator     – { displayName, username, profileImage }
 *  onClose     – () => void
 *  onChange    – (newIndex) => void  (optional)
 */
export default function PostLightbox({ post, posts, currentIndex, creator, onClose, onChange, currentUser, isSubscribed, onGate }) {
    // Support both single-post mode and array navigation mode
    const [localIdx, setLocalIdx] = useState(currentIndex ?? 0);
    const activePost = posts ? posts[localIdx] : post;
    const mediaUrl = Array.isArray(activePost?.mediaUrls) ? activePost.mediaUrls[0] : activePost?.mediaUrl;
    const isVideo = activePost?.mediaType === 'video';
    const hasPrev = posts && localIdx > 0;
    const hasNext = posts && localIdx < posts.length - 1;

    // Touch swipe tracking
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);

    const goTo = useCallback((idx) => {
        setLocalIdx(idx);
        onChange?.(idx);
    }, [onChange]);

    const goPrev = useCallback(() => { if (hasPrev) goTo(localIdx - 1); }, [hasPrev, localIdx, goTo]);
    const goNext = useCallback(() => { if (hasNext) goTo(localIdx + 1); }, [hasNext, localIdx, goTo]);

    // Keyboard navigation
    const handleKey = useCallback((e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === 'ArrowRight') goNext();
    }, [onClose, goPrev, goNext]);

    useEffect(() => {
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [handleKey]);

    // Touch swipe handlers
    const onTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
        // Only trigger if horizontal swipe is dominant and meaningful
        if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
            if (dx < 0) goNext();
            else goPrev();
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };

    if (!activePost) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-md"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-black/60 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center"
                aria-label="Close"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* ── Prev Arrow ────────────────────────────────── */}
            {hasPrev && (
                <button
                    onClick={goPrev}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 border border-white/15 text-white hover:bg-white/15 active:scale-95 transition-all flex items-center justify-center shadow-xl"
                    aria-label="Previous"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* ── Next Arrow ─────────────────────────────────── */}
            {hasNext && (
                <button
                    onClick={goNext}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 border border-white/15 text-white hover:bg-white/15 active:scale-95 transition-all flex items-center justify-center shadow-xl"
                    aria-label="Next"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* ── Dot indicators ─────────────────────────────── */}
            {posts && posts.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                    {posts.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === localIdx ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'}`}
                            aria-label={`Go to ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Main layout */}
            <div
                className="flex flex-col lg:flex-row w-full max-w-5xl max-h-screen h-full lg:h-auto lg:max-h-[90vh] overflow-hidden rounded-none lg:rounded-2xl"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {/* ── Media panel ───────────────────────────────── */}
                <div className="flex-1 bg-black flex items-center justify-center min-h-[50vh] lg:min-h-0 relative overflow-hidden select-none">
                    {activePost.mediaType === 'album' && activePost.mediaUrls?.length > 1 ? (
                        <AlbumCarousel
                            urls={activePost.mediaUrls}
                            alt={activePost.caption || 'Album'}
                            className="w-full h-full"
                        />
                    ) : mediaUrl ? (
                        isVideo ? (
                            <video
                                key={mediaUrl}
                                src={mediaUrl}
                                controls
                                autoPlay
                                className="max-w-full max-h-full object-contain"
                                style={{ maxHeight: '90vh' }}
                            />
                        ) : (
                            <img
                                key={mediaUrl}
                                src={mediaUrl}
                                alt={activePost.caption || ''}
                                className="max-w-full max-h-full object-contain"
                                style={{ maxHeight: '90vh' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                                draggable={false}
                            />
                        )
                    ) : (
                        <div className="text-6xl opacity-30">🖼️</div>
                    )}

                    {/* Locked badge */}
                    {activePost.isLocked && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/70 px-3 py-1 rounded-full text-xs text-brand-300 font-semibold border border-brand-500/30">
                            🔒 Subscribers only
                        </div>
                    )}

                    {/* Counter badge */}
                    {posts && posts.length > 1 && (
                        <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-xs text-white/70 font-medium">
                            {localIdx + 1} / {posts.length}
                        </div>
                    )}
                </div>

                {/* ── Info panel ────────────────────────────────── */}
                <div className="w-full lg:w-80 flex-shrink-0 bg-[#0d0d12] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col max-h-48 lg:max-h-none overflow-y-auto">

                    {/* Creator header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
                        {creator?.profileImage ? (
                            <img src={creator.profileImage} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-brand-500/30 flex-shrink-0" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {creator?.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{creator?.displayName}</p>
                            <p className="text-surface-500 text-xs">@{creator?.username}</p>
                        </div>
                        <span className="ml-auto text-surface-600 text-xs flex-shrink-0">{timeAgo(activePost.createdAt)}</span>
                    </div>

                    {/* Caption */}
                    <div className="flex-1 px-4 py-3 overflow-y-auto">
                        {activePost.caption ? (
                            <p className="text-surface-300 text-sm leading-relaxed">{activePost.caption}</p>
                        ) : (
                            <p className="text-surface-600 text-sm italic">No caption</p>
                        )}
                    </div>

                    {/* Like + Comment actions */}
                    <div className="px-4 py-3 border-t border-white/5 flex items-center gap-4 text-sm flex-shrink-0">
                        <LikeButton
                            postId={activePost._id}
                            initialLiked={!!activePost.isLiked}
                            initialCount={activePost.likesCount ?? 0}
                            isSubscribed={isSubscribed ?? true}
                            onGate={onGate}
                        />
                        <span className="flex items-center gap-1.5 text-surface-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {activePost.commentsCount ?? 0}
                        </span>
                        {activePost.mediaType === 'video' && (
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs">🎬 Video</span>
                        )}
                        {activePost.isLocked && (
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 text-xs">🔒 Locked</span>
                        )}
                    </div>

                    {/* Inline comments */}
                    <div className="flex-1 overflow-y-auto border-t border-white/5">
                        <CommentSection
                            postId={activePost._id}
                            creatorId={activePost.creatorId?._id || activePost.creatorId}
                            currentUser={currentUser}
                            isSubscribed={isSubscribed ?? true}
                            onGate={onGate}
                            compact
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
