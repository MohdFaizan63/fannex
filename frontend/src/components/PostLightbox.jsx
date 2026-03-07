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
 * PostLightbox — full-screen immersive media viewer (Instagram / Fanvue style)
 *
 * Props:
 *  posts        – array of post objects  (optional — enables prev/next)
 *  currentIndex – index in `posts` array (optional)
 *  post         – single post object (used when no posts array)
 *  creator      – { displayName, username, profileImage }
 *  onClose      – () => void
 *  onChange     – (newIndex) => void  (optional)
 */
export default function PostLightbox({
    post, posts, currentIndex, creator, onClose, onChange, currentUser, isSubscribed, onGate,
}) {
    const [localIdx, setLocalIdx] = useState(currentIndex ?? 0);
    const [uiVisible, setUiVisible] = useState(true);       // tap-to-toggle UI
    const [showComments, setShowComments] = useState(false);

    const activePost = posts ? posts[localIdx] : post;

    // Support albums per-post
    const mediaUrls = activePost?.mediaUrls?.length > 1 ? activePost.mediaUrls : null;  // album
    const mediaUrl = mediaUrls ? mediaUrls[0] : (Array.isArray(activePost?.mediaUrls) ? activePost.mediaUrls[0] : activePost?.mediaUrl);
    const isVideo = activePost?.mediaType === 'video';
    const hasPrev = posts && localIdx > 0;
    const hasNext = posts && localIdx < posts.length - 1;

    // Touch swipe
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const touchMoved = useRef(false);

    const goTo = useCallback((idx) => { setLocalIdx(idx); onChange?.(idx); }, [onChange]);
    const goPrev = useCallback(() => { if (hasPrev) goTo(localIdx - 1); }, [hasPrev, localIdx, goTo]);
    const goNext = useCallback(() => { if (hasNext) goTo(localIdx + 1); }, [hasNext, localIdx, goTo]);

    // Keyboard
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

    // Touch handlers
    const onTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchMoved.current = false;
    };
    const onTouchMove = (e) => {
        if (touchStartX.current === null) return;
        const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
        const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
        if (dx > 8 || dy > 8) touchMoved.current = true;
    };
    const onTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
        if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
            // horizontal swipe
            if (dx < 0) goNext(); else goPrev();
        } else if (!touchMoved.current) {
            // tap → toggle UI
            setUiVisible((v) => !v);
        }
        touchStartX.current = null;
        touchStartY.current = null;
        touchMoved.current = false;
    };

    if (!activePost) return null;

    const totalPosts = posts?.length ?? 1;
    const isAlbum = activePost.mediaType === 'album' && mediaUrls?.length > 1;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            style={{ touchAction: 'pan-y' }}
        >
            {/* ── Top gradient overlay ───────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
                style={{
                    height: '90px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
                    opacity: uiVisible ? 1 : 0,
                    transition: 'opacity 0.25s ease',
                }}
            />

            {/* ── Top controls bar ──────────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
                style={{
                    height: '56px',
                    opacity: uiVisible ? 1 : 0,
                    transition: 'opacity 0.25s ease',
                    pointerEvents: uiVisible ? 'auto' : 'none',
                }}
            >
                {/* Left: post index or spacer */}
                <div className="w-11 flex items-center justify-start">
                    {totalPosts > 1 && (
                        <span className="text-xs font-semibold text-white/70">
                            {localIdx + 1}/{totalPosts}
                        </span>
                    )}
                </div>

                {/* Center: creator name */}
                <span className="text-sm font-semibold text-white/90 truncate max-w-[160px]">
                    {creator?.displayName || ''}
                </span>

                {/* Right: close */}
                <button
                    onClick={onClose}
                    className="w-11 h-11 flex items-center justify-center rounded-full text-white transition-all"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                    aria-label="Close"
                >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* ── Media section ─────────────────────────────────────────────── */}
            <div
                className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
                style={{ background: '#000' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {isAlbum ? (
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
                            preload="metadata"
                            className="w-full"
                            style={{ maxHeight: '75vh', objectFit: 'contain' }}
                        />
                    ) : (
                        <img
                            key={mediaUrl}
                            src={mediaUrl}
                            alt={activePost.caption || ''}
                            loading="lazy"
                            draggable={false}
                            className="w-full"
                            style={{ maxHeight: '75vh', objectFit: 'cover', borderRadius: 0 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    )
                ) : (
                    <div className="text-6xl opacity-30">🖼️</div>
                )}

                {/* ── Prev arrow ─────────────────────────────────────────── */}
                {hasPrev && uiVisible && (
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        aria-label="Previous"
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-all active:scale-90"
                        style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', opacity: 0.85 }}
                    >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                {/* ── Next arrow ─────────────────────────────────────────── */}
                {hasNext && uiVisible && (
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        aria-label="Next"
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-all active:scale-90"
                        style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', opacity: 0.85 }}
                    >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* ── Locked badge ───────────────────────────────────────── */}
                {activePost.isLocked && (
                    <div className="absolute top-16 left-0 right-0 flex justify-center z-10">
                        <span className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full text-xs text-brand-300 font-semibold border border-brand-500/30">
                            🔒 Subscribers only
                        </span>
                    </div>
                )}

                {/* ── Dot indicators (over media, above bottom panel) ─────── */}
                {posts && posts.length > 1 && (
                    <div
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5"
                        style={{ opacity: uiVisible ? 1 : 0, transition: 'opacity 0.25s ease' }}
                    >
                        {posts.map((_, i) => (
                            <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                                aria-label={`Go to ${i + 1}`}
                                style={{
                                    width: 6, height: 6,
                                    borderRadius: '50%',
                                    background: i === localIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                                    transform: i === localIdx ? 'scale(1.3)' : 'scale(1)',
                                    transition: 'all 0.2s ease',
                                    padding: 0, border: 'none', cursor: 'pointer',
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Bottom content panel ──────────────────────────────────────── */}
            <div
                className="relative flex-shrink-0"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.97) 80%, rgba(0,0,0,0.6) 100%)',
                    paddingBottom: 'env(safe-area-inset-bottom, 8px)',
                }}
            >
                <div className="px-4 pt-4 pb-2">
                    {/* Creator row */}
                    <div className="flex items-center gap-3 mb-2">
                        {creator?.profileImage ? (
                            <img
                                src={creator.profileImage}
                                alt=""
                                loading="lazy"
                                className="shrink-0 object-cover"
                                style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(204,82,184,0.4)' }}
                            />
                        ) : (
                            <div
                                className="shrink-0 flex items-center justify-center text-white font-bold text-sm"
                                style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #cc52b8, #7c3aed)' }}
                            >
                                {creator?.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold leading-tight truncate">{creator?.displayName}</p>
                            <p className="text-white/50 text-xs">@{creator?.username}</p>
                        </div>
                        <span className="text-white/40 text-xs shrink-0">{timeAgo(activePost.createdAt)}</span>
                    </div>

                    {/* Caption */}
                    {activePost.caption && (
                        <p className="text-white/80 text-sm leading-relaxed mb-3 line-clamp-3">
                            {activePost.caption}
                        </p>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center gap-5 py-2 border-t border-white/8">
                        <LikeButton
                            postId={activePost._id}
                            initialLiked={!!activePost.isLiked}
                            initialCount={activePost.likesCount ?? 0}
                            isSubscribed={isSubscribed ?? true}
                            onGate={onGate}
                        />
                        <button
                            onClick={() => setShowComments((v) => !v)}
                            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>{activePost.commentsCount ?? 0}</span>
                        </button>
                        {activePost.isLocked && (
                            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium text-brand-300" style={{ background: 'rgba(204,82,184,0.15)', border: '1px solid rgba(204,82,184,0.25)' }}>
                                🔒 Locked
                            </span>
                        )}
                        {activePost.mediaType === 'video' && (
                            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium text-violet-300" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                                🎬 Video
                            </span>
                        )}
                    </div>
                </div>

                {/* Inline comments (expandable) */}
                {showComments && (
                    <div
                        className="border-t border-white/8 overflow-y-auto"
                        style={{ maxHeight: '45vh', background: 'rgba(0,0,0,0.6)' }}
                    >
                        <CommentSection
                            postId={activePost._id}
                            creatorId={activePost.creatorId?._id || activePost.creatorId}
                            currentUser={currentUser}
                            isSubscribed={isSubscribed ?? true}
                            onGate={onGate}
                            compact
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
