import { useEffect, useCallback, useRef, useState } from 'react';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ── Pinch-to-zoom hook ────────────────────────────────────────────────────────
function usePinchZoom() {
    const [scale, setScale] = useState(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 }); // percent
    const lastDist = useRef(null);
    const lastScale = useRef(1);

    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t, rect) => ({
        x: ((t[0].clientX + t[1].clientX) / 2 - rect.left) / rect.width * 100,
        y: ((t[0].clientY + t[1].clientY) / 2 - rect.top) / rect.height * 100,
    });

    const onPinchStart = (e) => {
        if (e.touches.length !== 2) return;
        lastDist.current = dist(e.touches);
        lastScale.current = scale;
    };

    const onPinchMove = (e) => {
        if (e.touches.length !== 2 || lastDist.current === null) return;
        e.preventDefault();
        const d = dist(e.touches);
        const factor = d / lastDist.current;
        const next = Math.min(4, Math.max(1, lastScale.current * factor));
        setScale(next);
        const rect = e.currentTarget.getBoundingClientRect();
        setOrigin(mid(e.touches, rect));
    };

    const onPinchEnd = (e) => {
        if (e.touches.length < 2) lastDist.current = null;
    };

    const resetZoom = () => { setScale(1); setOrigin({ x: 50, y: 50 }); };

    return { scale, origin, resetZoom, onPinchStart, onPinchMove, onPinchEnd };
}

export default function PostLightbox({
    post, posts, currentIndex, creator, onClose, onChange, currentUser, isSubscribed, onGate,
}) {
    const [localIdx, setLocalIdx] = useState(currentIndex ?? 0);
    const [chrome, setChrome] = useState(true);
    const [showComments, setShowComments] = useState(false);
    const { scale, origin, resetZoom, onPinchStart, onPinchMove, onPinchEnd } = usePinchZoom();
    const lastTap = useRef(0); // double-tap to reset zoom
    const commentPanelRef = useRef(null);
    const commentBtnRef = useRef(null);

    const activePost = posts ? posts[localIdx] : post;
    const isAlbum = activePost?.mediaType === 'album' && activePost?.mediaUrls?.length > 1;
    const mediaUrl = isAlbum
        ? activePost.mediaUrls[0]
        : (activePost?.mediaUrls?.[0] ?? activePost?.mediaUrl);
    const isVideo = activePost?.mediaType === 'video';
    // album sub-index
    const [albumIdx, setAlbumIdx] = useState(0);
    const albumLen = isAlbum ? activePost.mediaUrls.length : 1;
    const shownUrl = isAlbum ? activePost.mediaUrls[albumIdx] : mediaUrl;

    // touch
    const tx0 = useRef(null);
    const ty0 = useRef(null);
    const moved = useRef(false);

    // Navigation is locked to the opened card only — never jumps to another post
    const goPrev = useCallback(() => {
        if (isAlbum && albumIdx > 0) setAlbumIdx(i => i - 1);
    }, [isAlbum, albumIdx]);
    const goNext = useCallback(() => {
        if (isAlbum && albumIdx < albumLen - 1) setAlbumIdx(i => i + 1);
    }, [isAlbum, albumIdx, albumLen]);

    const canPrev = isAlbum && albumIdx > 0;
    const canNext = isAlbum && albumIdx < albumLen - 1;

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, [onClose, goPrev, goNext]);

    const onTS = (e) => {
        if (e.touches.length === 2) { onPinchStart(e); return; } // pinch start
        tx0.current = e.touches[0].clientX;
        ty0.current = e.touches[0].clientY;
        moved.current = false;
    };
    // onTM is now handled by non-passive useEffect listener (to allow preventDefault)
    const onTM = undefined; // kept for clarity — not used on element directly
    const onTE = (e) => {
        onPinchEnd(e);
        if (e.touches.length > 0) return; // still fingers on screen
        if (tx0.current === null) return;
        const dx = e.changedTouches[0].clientX - tx0.current;
        const dy = Math.abs(e.changedTouches[0].clientY - ty0.current);
        if (scale > 1) { tx0.current = null; return; } // zoomed — don't navigate
        if (Math.abs(dx) > 48 && Math.abs(dx) > dy * 1.4) {
            dx < 0 ? goNext() : goPrev();
        } else if (!moved.current) {
            // double-tap = reset zoom, single-tap = toggle chrome
            const now = Date.now();
            if (now - lastTap.current < 300) { resetZoom(); }
            else { setChrome(v => !v); }
            lastTap.current = now;
        }
        tx0.current = null;
    };

    if (!activePost) return null;

    const totalSlides = isAlbum ? albumLen : 1;
    const slideIdx = isAlbum ? albumIdx : 0;

    // Non-passive touchmove ref — needed to call preventDefault (stops scroll/shake jitter)
    const mediaRef = useRef(null);
    useEffect(() => {
        const el = mediaRef.current;
        if (!el) return;
        const handler = (e) => {
            if (e.touches.length === 2) { onPinchMove(e); return; }
            if (tx0.current === null) return;
            const dx = Math.abs(e.touches[0].clientX - tx0.current);
            const dy = Math.abs(e.touches[0].clientY - ty0.current);
            // Prevent ALL scroll while a swipe gesture is in progress — eliminates vertical shake
            if (dx > 4 || dy > 4) {
                e.preventDefault();
                moved.current = true;
            }
        };
        el.addEventListener('touchmove', handler, { passive: false });
        return () => el.removeEventListener('touchmove', handler);
    }, [onPinchMove]);

    // Close comments when tapping outside the panel
    useEffect(() => {
        if (!showComments) return;
        const close = (e) => {
            if (
                commentPanelRef.current && !commentPanelRef.current.contains(e.target) &&
                commentBtnRef.current && !commentBtnRef.current.contains(e.target)
            ) {
                setShowComments(false);
            }
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('touchstart', close, { passive: true });
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('touchstart', close);
        };
    }, [showComments]);

    return (
        <div className="fixed inset-x-0 top-0 z-[200] bg-black flex flex-col" style={{ height: '100dvh', touchAction: 'none' }}>

            {/* ── TOP BAR ───────────────────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3"
                style={{
                    height: 52,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                    opacity: chrome ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: chrome ? 'auto' : 'none',
                }}
            >
                {/* Close */}
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-white"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                    aria-label="Close"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Slide counter */}
                {totalSlides > 1 && (
                    <span className="text-white text-xs font-medium tracking-wide" style={{ opacity: 0.85 }}>
                        {slideIdx + 1} / {totalSlides}
                    </span>
                )}

                {/* spacer so counter is centered */}
                <div className="w-10" />
            </div>

            {/* ── MEDIA AREA ────────────────────────────────────────────────── */}
            <div
                ref={mediaRef}
                className="flex-1 flex items-center justify-center relative overflow-hidden"
                onTouchStart={onTS}
                onTouchEnd={onTE}
                style={{ touchAction: 'none' }}
            >
                {isVideo ? (
                    <video
                        key={shownUrl}
                        src={shownUrl}
                        controls
                        autoPlay
                        preload="metadata"
                        className="w-full h-full object-contain"
                        style={{
                            maxHeight: '100%',
                            transform: `scale(${scale})`,
                            transformOrigin: `${origin.x}% ${origin.y}%`,
                            transition: scale === 1 ? 'transform 0.2s ease' : 'none',
                        }}
                    />
                ) : shownUrl ? (
                    <img
                        key={shownUrl}
                        src={shownUrl}
                        alt={activePost.caption || ''}
                        loading="lazy"
                        draggable={false}
                        className="w-full h-full object-contain select-none"
                        style={{
                            maxHeight: '100%',
                            transform: `scale(${scale})`,
                            transformOrigin: `${origin.x}% ${origin.y}%`,
                            transition: scale === 1 ? 'transform 0.2s ease' : 'none',
                            cursor: scale > 1 ? 'grab' : 'default',
                            willChange: 'transform',
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                ) : (
                    <span className="text-5xl opacity-20">🖼️</span>
                )}

                {/* Prev / Next tap zones — hidden when zoomed in */}
                {canPrev && scale === 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        className="absolute left-0 top-0 bottom-0 w-16 z-10"
                        aria-label="Previous"
                        style={{ background: 'transparent' }}
                    />
                )}
                {canNext && scale === 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        className="absolute right-0 top-0 bottom-0 w-16 z-10"
                        aria-label="Next"
                        style={{ background: 'transparent' }}
                    />
                )}

                {/* Dot indicator — only if multiple slides */}
                {totalSlides > 1 && (
                    <div
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20"
                        style={{ opacity: chrome ? 0.9 : 0, transition: 'opacity 0.2s ease' }}
                    >
                        {Array.from({ length: totalSlides }).map((_, i) => (
                            <span key={i} style={{
                                display: 'block',
                                width: i === slideIdx ? 18 : 6,
                                height: 6,
                                borderRadius: 999,
                                background: i === slideIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                                transition: 'width 0.25s ease, background 0.2s ease',
                            }} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── BOTTOM PANEL ──────────────────────────────────────────────── */}
            <div
                style={{
                    background: '#0d0d0d',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    opacity: chrome ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: chrome ? 'auto' : 'none',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    flexShrink: 0,
                }}
            >
                <div className="px-4 pt-3 pb-1">
                    {/* Creator + time */}
                    <div className="flex items-center gap-2.5 mb-2">
                        {creator?.profileImage ? (
                            <img src={creator.profileImage} alt=""
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                                style={{ border: '1.5px solid rgba(255,255,255,0.12)' }}
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: 'linear-gradient(135deg,#cc52b8,#7c3aed)' }}>
                                {creator?.displayName?.[0]?.toUpperCase() ?? '?'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <span className="text-white text-sm font-semibold">{creator?.displayName}</span>
                            <span className="text-white/40 text-xs ml-1.5">@{creator?.username}</span>
                        </div>
                        <span className="text-white/30 text-xs shrink-0">{timeAgo(activePost.createdAt)}</span>
                    </div>

                    {/* Caption */}
                    {activePost.caption && (
                        <p className="text-white/70 text-sm leading-relaxed mb-2 line-clamp-2">
                            {activePost.caption}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 py-1">
                        <LikeButton
                            postId={activePost._id}
                            initialLiked={!!activePost.isLiked}
                            initialCount={activePost.likesCount ?? 0}
                            isSubscribed={isSubscribed ?? true}
                            onGate={onGate}
                        />
                        <button
                            ref={commentBtnRef}
                            onClick={() => setShowComments(true)}
                            className="flex items-center gap-1.5 text-sm transition-colors"
                            style={{ color: showComments ? '#fff' : 'rgba(255,255,255,0.5)' }}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {activePost.commentsCount ?? 0}
                        </button>
                        {activePost.isLocked && (
                            <span className="ml-auto text-xs text-brand-300 font-medium">🔒 Locked</span>
                        )}
                    </div>
                </div>

                {/* Inline comments */}
                {showComments && (
                    <div
                        ref={commentPanelRef}
                        className="border-t border-white/6 overflow-y-auto"
                        style={{ maxHeight: '40vh' }}
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
