import { useState, useEffect, useCallback, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import AlbumCarousel from './AlbumCarousel';

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const d = Math.floor(hrs / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * MediaModal — Premium fullscreen media viewer/gallery
 *
 * Props:
 *  posts        – array of post objects
 *  currentIndex – index of the post to show initially
 *  creator      – { displayName, username, profileImage }
 *  onClose      – () => void
 *  onNavigate   – (newIndex) => void  (optional, to sync parent state)
 */
export default function MediaModal({ posts, currentIndex = 0, creator, onClose, onNavigate, currentUser, isSubscribed, onGate }) {
    const [index, setIndex] = useState(currentIndex);
    const [zoom, setZoom] = useState(1);
    const [panPos, setPanPos] = useState({ x: 0, y: 0 });
    const [imgLoaded, setImgLoaded] = useState(false);
    const [showInfo, setShowInfo] = useState(true);
    const imgRef = useRef(null);
    const touchRef = useRef({ startX: 0, startY: 0 });

    const post = posts?.[index];
    const mediaUrl = post ? (Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : post.mediaUrl) : null;
    const isVideo = post?.mediaType === 'video';
    const total = posts?.length ?? 0;
    const hasPrev = index > 0;
    const hasNext = index < total - 1;

    // ── Navigation ──────────────────────────────────────────────────────────
    const goPrev = useCallback(() => {
        if (!hasPrev) return;
        setIndex(i => { const n = i - 1; onNavigate?.(n); return n; });
        resetZoom();
    }, [hasPrev, onNavigate]);

    const goNext = useCallback(() => {
        if (!hasNext) return;
        setIndex(i => { const n = i + 1; onNavigate?.(n); return n; });
        resetZoom();
    }, [hasNext, onNavigate]);

    // ── Zoom & Pan (images only) ────────────────────────────────────────────
    const resetZoom = () => { setZoom(1); setPanPos({ x: 0, y: 0 }); setImgLoaded(false); };

    const toggleZoom = () => {
        if (isVideo) return;
        if (zoom > 1) { resetZoom(); }
        else { setZoom(2.5); setPanPos({ x: 0, y: 0 }); }
    };

    const handleWheel = (e) => {
        if (isVideo) return;
        e.preventDefault();
        setZoom(z => Math.max(1, Math.min(5, z + (e.deltaY > 0 ? -0.3 : 0.3))));
    };

    const handleMouseMove = (e) => {
        if (zoom <= 1 || isVideo) return;
        const rect = imgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * -100;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * -100;
        setPanPos({ x, y });
    };

    // ── Touch / Swipe (mobile) ──────────────────────────────────────────────
    const handleTouchStart = (e) => {
        touchRef.current.startX = e.touches[0].clientX;
        touchRef.current.startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const dx = e.changedTouches[0].clientX - touchRef.current.startX;
        const dy = e.changedTouches[0].clientY - touchRef.current.startY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
            if (dx > 0) goPrev(); else goNext();
        }
    };

    // ── Keyboard ────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key) {
                case 'Escape': e.preventDefault(); onClose(); break;
                case 'ArrowLeft': e.preventDefault(); goPrev(); break;
                case 'ArrowRight': e.preventDefault(); goNext(); break;
                case '+': case '=': e.preventDefault(); setZoom(z => Math.min(5, z + 0.5)); break;
                case '-': e.preventDefault(); setZoom(z => Math.max(1, z - 0.5)); break;
                case '0': e.preventDefault(); resetZoom(); break;
                case 'i': e.preventDefault(); setShowInfo(s => !s); break;
            }
        };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose, goPrev, goNext]);

    // Reset zoom when index changes
    useEffect(() => { resetZoom(); }, [index]);

    if (!post) return null;

    return (
        <div className="fixed inset-0 z-[100] flex"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* ── Backdrop ────────────────────────────────────────────────── */}
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />

            {/* ── Top bar ─────────────────────────────────────────────────── */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
                {/* Counter */}
                <span className="text-xs text-white/60 font-mono bg-black/40 px-3 py-1 rounded-full">
                    {index + 1} / {total}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {!isVideo && (
                        <button onClick={toggleZoom} className="w-8 h-8 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all text-xs font-bold">
                            {zoom > 1 ? '−' : '+'}
                        </button>
                    )}
                    <button onClick={() => setShowInfo(s => !s)} className="w-8 h-8 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Prev / Next buttons ─────────────────────────────────────── */}
            {hasPrev && (
                <button
                    onClick={goPrev}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            {hasNext && (
                <button
                    onClick={goNext}
                    className={`absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center transition-all hover:scale-110 ${showInfo ? 'right-2 sm:right-4 lg:right-[340px]' : 'right-2 sm:right-4'}`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* ── Media area ──────────────────────────────────────────────── */}
            <div
                className="relative flex-1 flex items-center justify-center z-10 overflow-hidden"
                onWheel={handleWheel}
                onMouseMove={handleMouseMove}
            >
                {post.mediaType === 'album' && post.mediaUrls?.length > 1 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <AlbumCarousel
                            urls={post.mediaUrls}
                            alt={post.caption || 'Album'}
                            className="w-full h-full max-h-screen"
                        />
                    </div>
                ) : isVideo ? (
                    <VideoPlayer
                        src={mediaUrl}
                        autoPlay
                        className="w-full h-full max-h-screen"
                    />
                ) : mediaUrl ? (
                    <div className="relative flex items-center justify-center w-full h-full">
                        {!imgLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full border-3 border-white/20 border-t-white animate-spin" />
                            </div>
                        )}
                        <img
                            ref={imgRef}
                            src={mediaUrl}
                            alt={post.caption || ''}
                            onLoad={() => setImgLoaded(true)}
                            onDoubleClick={toggleZoom}
                            className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
                            style={{
                                transform: `scale(${zoom}) translate(${panPos.x}px, ${panPos.y}px)`,
                                cursor: zoom > 1 ? 'grab' : 'zoom-in',
                                opacity: imgLoaded ? 1 : 0,
                            }}
                            draggable={false}
                        />
                    </div>
                ) : (
                    <div className="text-6xl text-white/20 select-none">🖼️</div>
                )}

                {/* Locked badge */}
                {post.isLocked && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/70 px-4 py-1.5 rounded-full text-xs text-brand-300 font-semibold border border-brand-500/30 backdrop-blur-sm">
                        🔒 Subscribers only
                    </div>
                )}
            </div>

            {/* ── Info sidebar (toggleable) ────────────────────────────────── */}
            <div className={`hidden lg:flex flex-col bg-surface-950/95 backdrop-blur border-l border-white/10 transition-all duration-300 z-10 ${showInfo ? 'w-80' : 'w-0 overflow-hidden opacity-0'}`}>
                {/* Creator */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5 flex-shrink-0">
                    {creator?.profileImage ? (
                        <img src={creator.profileImage} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-brand-500/30 flex-shrink-0" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                            {creator?.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{creator?.displayName}</p>
                        <p className="text-surface-500 text-xs">@{creator?.username}</p>
                    </div>
                    <span className="ml-auto text-surface-600 text-xs flex-shrink-0">{timeAgo(post.createdAt)}</span>
                </div>

                {/* Caption */}
                <div className="flex-1 px-4 py-4 overflow-y-auto">
                    {post.caption ? (
                        <p className="text-surface-300 text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                    ) : (
                        <p className="text-surface-600 text-sm italic">No caption</p>
                    )}
                </div>

                {/* Stats footer */}
                <div className="px-4 py-3 border-t border-white/5 flex items-center gap-4 text-sm flex-shrink-0">
                    <LikeButton
                        postId={post._id}
                        initialLiked={!!post.isLiked}
                        initialCount={post.likesCount ?? 0}
                        isSubscribed={isSubscribed ?? true}
                        onGate={onGate}
                    />
                    <span className="flex items-center gap-1.5 text-surface-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post.commentsCount ?? 0}
                    </span>
                    {isVideo && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium">🎬 Video</span>
                    )}
                </div>

                {/* Inline comments */}
                <div className="flex-1 overflow-y-auto border-t border-white/5 min-h-0">
                    <CommentSection
                        postId={post._id}
                        creatorId={post.creatorId?._id || post.creatorId}
                        currentUser={currentUser}
                        isSubscribed={isSubscribed ?? true}
                        onGate={onGate}
                        compact
                    />
                </div>

                {/* Keyboard help */}
                <div className="px-4 py-2 border-t border-white/5 flex-shrink-0">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-surface-600">
                        <span>← → Navigate</span>
                        <span>Esc Close</span>
                        <span>+/− Zoom</span>
                        <span>i Toggle Info</span>
                    </div>
                </div>
            </div>

            {/* ── Mobile bottom info ──────────────────────────────────────── */}
            <div className="lg:hidden absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-16">
                <div className="flex items-center gap-3 mb-2">
                    {creator?.profileImage ? (
                        <img src={creator.profileImage} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {creator?.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    )}
                    <span className="text-white text-sm font-semibold">{creator?.displayName}</span>
                    <span className="text-surface-500 text-xs ml-auto">{timeAgo(post.createdAt)}</span>
                </div>
                {post.caption && (
                    <p className="text-white/80 text-xs leading-relaxed line-clamp-3">{post.caption}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-surface-500">
                    <span>❤️ {post.likesCount ?? 0}</span>
                    <span>💬 {post.commentsCount ?? 0}</span>
                </div>
            </div>
        </div>
    );
}
