import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import subscriptionService from '../services/subscriptionService';
import postService from '../services/postService';
import api from '../services/api';
import PostLightbox from '../components/PostLightbox';
import ChatButton from '../components/chat/ChatButton';
import LikeButton from '../components/LikeButton';
import CommentSection from '../components/CommentSection';
import SubscribeGateModal from '../components/SubscribeGateModal';
import AlbumCarousel from '../components/AlbumCarousel';
import GiftModal from '../components/GiftModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 'md', objectPosition }) {
    const sizing = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-base',
        lg: 'w-[110px] h-[110px] text-3xl',
    };
    const sz = sizing[size] || sizing.md;

    if (size === 'lg') {
        return (
            // Ring wrapper — gradient border like Explore card
            <div className="rounded-full p-[3px] bg-gradient-to-br from-brand-500 via-violet-500 to-brand-400 shadow-xl shadow-brand-500/30 border-[3px] border-surface-950 flex-shrink-0">
                <div className={`${sz} rounded-full overflow-hidden bg-surface-900`}>
                    {src ? (
                        <img src={src} alt={name} loading="lazy" className="w-full h-full object-cover"
                            style={{ objectPosition: `center ${objectPosition ?? 50}%` }} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-500 to-violet-600 text-white font-bold text-3xl">
                            {name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return src ? (
        <img src={src} alt={name} loading="lazy" className={`${sz} rounded-full object-cover flex-shrink-0`} />
    ) : (
        <div className={`${sz} rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
    );
}

// ─── Locked post overlay ─────────────────────────────────────────────────────
function LockedOverlay({ onSubscribe }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center mb-3 shadow-lg">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
            </div>
            <p className="text-white font-bold text-sm mb-1 drop-shadow">Unlock to view</p>
            <p className="text-white/60 text-xs mb-4 drop-shadow">Subscribe for full access</p>
            <button onClick={onSubscribe}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-500 to-violet-600 text-white text-xs font-bold hover:shadow-lg hover:shadow-brand-500/30 transition-all hover:scale-105">
                Subscribe to unlock
            </button>
        </div>
    );
}

// ─── Post card (feed style) ──────────────────────────────────────────────────
function PostCard({ post, creator, isSubscribed, onSubscribe, onClick, currentUser, onGate }) {
    const locked = post.isLocked && !isSubscribed;
    const mediaUrl = Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : post.mediaUrl;
    const [showComments, setShowComments] = useState(false);

    return (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3">
                <Avatar src={creator?.profileImage} name={creator?.displayName} />
                <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-none">{creator?.displayName}</p>
                    <p className="text-surface-500 text-xs mt-0.5">@{creator?.username}</p>
                </div>
                <span className="text-surface-600 text-xs">{timeAgo(post.createdAt)}</span>
            </div>

            {/* Caption */}
            {post.caption && (
                <div className="px-4 pb-3">
                    <p className={`text-surface-300 text-sm leading-relaxed ${locked ? 'blur-sm select-none' : ''}`}>
                        {post.caption}
                    </p>
                </div>
            )}

            {/* Media */}
            <div className={`relative aspect-[4/3] bg-surface-900 overflow-hidden ${!locked && post.mediaType !== 'album' ? 'cursor-pointer' : ''}`}>
                {post.mediaType === 'album' && post.mediaUrls?.length > 1 ? (
                    <AlbumCarousel
                        urls={post.mediaUrls}
                        alt={post.caption || 'Album'}
                        className="w-full h-full"
                        locked={locked}
                        onImageClick={() => !locked && onClick?.()}
                    />
                ) : mediaUrl ? (
                    post.mediaType === 'video' ? (
                        <video
                            src={mediaUrl}
                            className={`w-full h-full object-cover ${locked ? 'blur-xl brightness-75 scale-110' : ''}`}
                            muted playsInline loop preload="metadata"
                            onClick={() => !locked && onClick?.()}
                        />
                    ) : (
                        <img src={mediaUrl} alt=""
                            loading="lazy"
                            onClick={() => !locked && onClick?.()}
                            className={`w-full h-full object-cover transition-all duration-500 ${locked ? 'blur-xl brightness-75 scale-110' : 'hover:scale-105 cursor-pointer'}`} />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-surface-700">🖼️</div>
                )}

                {locked && <LockedOverlay onSubscribe={onSubscribe} />}

                {!locked && post.mediaType === 'video' && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                        <span className="text-white text-xs font-medium">Video</span>
                    </div>
                )}
            </div>

            {/* Footer — like + comment buttons */}
            {!locked && (
                <div className="px-4 py-3 flex items-center gap-4 text-sm">
                    <LikeButton
                        postId={post._id}
                        initialLiked={!!post.isLiked}
                        initialCount={post.likesCount ?? 0}
                        isSubscribed={isSubscribed}
                        onGate={onGate}
                    />
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className="flex items-center gap-1.5 text-surface-500 hover:text-brand-400 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="font-medium">{post.commentsCount ?? 0}</span>
                    </button>
                </div>
            )}

            {/* Inline comment section */}
            {!locked && showComments && (
                <CommentSection
                    postId={post._id}
                    creatorId={creator?.userId || creator?._id}
                    currentUser={currentUser}
                    isSubscribed={isSubscribed}
                    onGate={onGate}
                />
            )}
        </div>
    );
}

// ─── Suggested creator card (Fanvue-style full-bleed cover) ──────────────────
function SuggestedCard({ creator }) {
    return (
        <Link to={`/creator/${creator.username}`} className="block" style={{ textDecoration: 'none' }}>
            <div style={{
                position: 'relative',
                height: 140,
                borderRadius: 14,
                overflow: 'hidden',
                background: 'linear-gradient(135deg,#2d0050,#0d0020)',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'; }}
            >
                {/* Cover photo */}
                {creator.coverImage ? (
                    <img src={creator.coverImage} alt="" loading="lazy"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.3, background: 'radial-gradient(circle at 30% 50%, #cc52b8, transparent 60%)' }} />
                )}

                {/* Dark gradient overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.05) 100%)',
                }} />

                {/* Top-right: price pill */}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <span style={{
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        color: '#fff',
                        fontSize: 11, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 999,
                    }}>
                        {creator.subscriptionPrice ? `₹${creator.subscriptionPrice}/mo` : 'Free'}
                    </span>
                </div>

                {/* Bottom: avatar + name overlaid */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    {/* Avatar */}
                    {creator.profileImage ? (
                        <img src={creator.profileImage} alt={creator.displayName} loading="lazy"
                            style={{
                                width: 42, height: 42, borderRadius: '50%',
                                objectFit: 'cover', flexShrink: 0,
                                border: '2.5px solid rgba(255,255,255,0.85)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            }} />
                    ) : (
                        <div style={{
                            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 14,
                            border: '2.5px solid rgba(255,255,255,0.85)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}>
                            {creator.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                    )}

                    {/* Name + handle */}
                    <div style={{ minWidth: 0 }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {creator.displayName}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: 0, lineHeight: 1.4 }}>
                            @{creator.username}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Posts', 'Media', 'Store'];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CreatorProfile() {
    const { id: usernameParam } = useParams();
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Preview mode: creator clicked "View Profile" from their dashboard.
    // Force isSubscribed=false so they see exactly what a fan sees.
    const isPreview = searchParams.get('preview') === 'true';
    const [showPreviewBanner, setShowPreviewBanner] = useState(isPreview);

    const [creator, setCreator] = useState(null);
    const [posts, setPosts] = useState([]);
    const [suggested, setSuggested] = useState([]);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('Posts');
    const [copied, setCopied] = useState(false);
    const [modalIndex, setModalIndex] = useState(-1);
    const [showGate, setShowGate] = useState(false);
    const [showGift, setShowGift] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [sugIdx, setSugIdx] = useState(0); // suggested creators carousel index
    // Tracks if user just paid — prevents profile re-fetch from overwriting isSubscribed=true
    const subscribedFromPaymentRef = useRef(false);

    // ── Load creator profile ─────────────────────────────────────────────────
    useEffect(() => {
        setLoadingProfile(true);
        api.get(`/creator/profile/${usernameParam}`)
            .then(({ data }) => {
                setCreator(data.data);
                // In preview mode always show isSubscribed=false (fan view)
                if (!subscribedFromPaymentRef.current && !isPreview) {
                    setIsSubscribed(data.data.isSubscribed ?? false);
                }
            })
            .catch(() => setError('Creator not found.'))
            .finally(() => setLoadingProfile(false));
    }, [usernameParam, isPreview]);

    // ── Load posts ───────────────────────────────────────────────────────────
    useEffect(() => {
        const id = creator?.userId || creator?._id;
        if (!id) return;
        setLoadingPosts(true);
        postService.getByCreator(id, { limit: 30 })
            .then(({ data }) => setPosts(data.results ?? []))
            .catch(() => { })
            .finally(() => setLoadingPosts(false));
    }, [creator?.userId, creator?._id]);

    // ── Load suggested creators ──────────────────────────────────────────
    useEffect(() => {
        if (!creator?.username) return;
        api.get('/creator/suggested', { params: { exclude: creator.username } })
            .then(({ data }) => {
                // Also filter out the current creator on the client side as a safety net
                const filtered = (data.data ?? []).filter(c => c.username !== creator.username);
                setSuggested(filtered);
                setSugIdx(0);
            })
            .catch(() => { });
    }, [creator?.username]);

    // ── Handle success return from SubscribePage / SubscriptionSuccess ──────────
    const location = useLocation();
    useEffect(() => {
        if (!location.state?.subscribed) return;

        // Mark paid — prevents profile API from overwriting isSubscribed=true
        subscribedFromPaymentRef.current = true;

        // Immediately update the button — don't wait for creator to load
        setIsSubscribed(true);

        // Clear the state so a browser refresh doesn't trigger this again
        window.history.replaceState({}, '', window.location.pathname);

        // Re-fetch posts if creator is already loaded (unlocks gated content)
        if (creator) {
            const id = creator.userId || creator._id;
            postService.getByCreator(id, { limit: 30 })
                .then(({ data }) => setPosts(data.results ?? []))
                .catch(() => { });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.subscribed, creator]);

    // ── Subscribe ────────────────────────────────────────────────────────────
    const handleSubscribe = useCallback(() => {
        if (isSubscribed) return;
        const username = creator?.username;
        if (!username) return;
        if (!isAuthenticated) {
            localStorage.setItem('fannex_fan_intent', 'true');
            navigate(
                `/register?from=creator&creator=${encodeURIComponent(username)}&redirect=${encodeURIComponent(`/creator/${username}/subscribe`)}`
            );
        } else {
            navigate(`/creator/${username}/subscribe`);
        }
    }, [isSubscribed, creator?.username, isAuthenticated, navigate]);

    const handleShare = useCallback(async () => {
        const url = window.location.href;
        try { await navigator.clipboard.writeText(url); } catch { }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // ── Filtered posts by tab ────────────────────────────────────────────────
    const filteredPosts = activeTab === 'Media'
        ? posts.filter((p) => p.mediaUrl || (p.mediaUrls && p.mediaUrls.length > 0))
        : posts;

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loadingProfile) return (
        <div className="max-w-5xl mx-auto pt-16">
            <div className="skeleton h-52 w-full" />
            <div className="px-6 -mt-12 pb-6">
                <div className="skeleton w-24 h-24 rounded-full ring-4 ring-surface-950" />
                <div className="skeleton h-7 w-48 mt-4" />
                <div className="skeleton h-4 w-64 mt-2" />
            </div>
        </div>
    );

    if (error || !creator) return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            <div className="text-5xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-white mb-2">Creator not found</h2>
            <p className="text-surface-400 text-sm">{error || 'This profile may have been removed.'}</p>
            <Link to="/explore" className="btn-brand mt-6 px-6 py-2">Browse Creators</Link>
        </div>
    );

    const { displayName, username, bio, profileImage, coverImage, coverImagePosition, profileImagePosition, subscriptionPrice = 0, totalSubscribers = 0 } = creator;
    const lockedCount = posts.filter((p) => p.isLocked && !isSubscribed).length;

    // True only when the logged-in user is viewing their own creator profile.
    // Creator-role users CAN subscribe to OTHER creators — only self-subscription is blocked.
    const isOwnProfile = isAuthenticated && user && (
        user.username === username ||
        user._id === creator?.userId ||
        user._id === creator?._id
    );

    return (
        <>
            {/* ── Preview mode banner ─────────────────────────────────────────── */}
            {isPreview && showPreviewBanner && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                    padding: '10px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>👁</span>
                        <div>
                            <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.3 }}>
                                You're in Preview Mode
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, margin: 0 }}>
                                This is exactly how fans see your profile
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPreviewBanner(false)}
                        style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none',
                            color: '#fff', borderRadius: 8,
                            padding: '4px 12px', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', flexShrink: 0,
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="min-h-screen bg-surface-950" style={isPreview && showPreviewBanner ? { paddingTop: 52 } : {}}>
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 lg:items-start px-0 lg:px-4 pb-16">

                        {/* ── LEFT: Main profile ─────────────────────────────────── */}
                        <div className="flex-1 min-w-0">

                            {/* Cover + nav overlay */}
                            <div className="relative h-48 sm:h-64 overflow-hidden bg-surface-800"
                                style={{ background: coverImage ? undefined : 'linear-gradient(135deg,#3a0060,#0d0020 55%,#1a0040)' }}>
                                {coverImage && <img src={coverImage} alt="cover" loading="lazy" className="w-full h-full object-cover"
                                    style={{ objectPosition: `center ${coverImagePosition ?? 50}%` }} />}
                                {/* Gradient fade at bottom */}
                                <div className="absolute inset-x-0 bottom-0 h-24"
                                    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-surface-950,#050208))' }} />

                                {/* ── Back arrow (top-left) ── */}
                                <button
                                    onClick={() => navigate(-1)}
                                    className="absolute top-3 left-3 z-20 w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70"
                                    style={{ background: 'none', border: 'none' }}
                                    title="Go back"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="15 18 9 12 15 6" />
                                    </svg>
                                </button>

                                {/* ── 3-dot menu (top-right) ── */}
                                <div className="absolute top-3 right-3 z-20">
                                    <button
                                        onClick={() => setShowMenu(v => !v)}
                                        className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-70"
                                        style={{ background: 'none', border: 'none' }}
                                        title="More options"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                        </svg>
                                    </button>

                                    {/* Dropdown */}
                                    {showMenu && (
                                        <>
                                            {/* Backdrop to close */}
                                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                            <div className="absolute right-0 top-11 z-20 rounded-xl overflow-hidden"
                                                style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setShowMenu(false);
                                                        window.location.href = `mailto:admin@fannex.in?subject=Report Creator: ${username}&body=I want to report the creator @${username} on Fannex.%0A%0AReason: `;
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
                                                    style={{ color: '#ff6b6b' }}
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                                                    </svg>
                                                    Report this user
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Profile header */}
                            <div className="relative z-10 px-4 sm:px-6 -mt-[58px]">
                                <div className="flex items-end justify-between">
                                    {/* Avatar */}
                                    <Avatar src={profileImage} name={displayName} size="lg" objectPosition={profileImagePosition} />

                                {/* Social action buttons — Instagram + Share */}
                                    <div className="mb-1 flex items-center gap-2">
                                        {/* Instagram button — only if creator has set their link */}
                                        {creator.instagramUrl && (
                                            <a
                                                href={creator.instagramUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Instagram"
                                                className="p-2.5 rounded-full glass border border-white/10 hover:border-white/20 transition-all flex items-center justify-center"
                                                style={{ lineHeight: 0 }}
                                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                            >
                                                {/* Instagram logo — gradient outline on dark bg to match Image 2 */}
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <defs>
                                                        <linearGradient id="igOutline" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                                                            <stop offset="0%" stopColor="#f9ed32"/>
                                                            <stop offset="25%" stopColor="#ee2a7b"/>
                                                            <stop offset="75%" stopColor="#002aff"/>
                                                        </linearGradient>
                                                    </defs>
                                                    <rect x="2" y="2" width="20" height="20" rx="6" ry="6" fill="none" stroke="url(#igOutline)" strokeWidth="2.2"/>
                                                    <circle cx="12" cy="12" r="4.5" fill="none" stroke="url(#igOutline)" strokeWidth="2.2"/>
                                                    <circle cx="17.5" cy="6.5" r="1.5" fill="url(#igOutline)"/>
                                                </svg>
                                            </a>
                                        )}

                                        {/* Share button */}
                                        <button onClick={handleShare}
                                            className="p-2.5 rounded-full glass border border-white/10 text-surface-400 hover:text-white hover:border-white/20 transition-all"
                                            title="Share profile">
                                            {copied
                                                ? <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                                        </button>
                                    </div>
                                </div>

                                {/* Name + stats — ABOVE buttons */}
                                <div className="mt-4">
                                    {/* Name */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-2xl font-black text-white">{displayName}</h1>
                                        {creator.creatorType === 'ai' && (
                                            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-semibold">AI</span>
                                        )}
                                    </div>
                                    <p className="mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>@{username}</p>

                                    {/* Stats row — icon + number only */}
                                    <div className="flex items-center gap-4 mt-2.5" style={{ fontSize: 13 }}>
                                        {/* Photo posts — use backend totalPosts */}
                                        <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                                            </svg>
                                            <strong style={{ color: '#fff', fontWeight: 700 }}>{(creator.totalPosts ?? posts.filter(p => p.mediaType !== 'video' && p.mediaType !== 'album').length).toLocaleString('en-IN')}</strong>
                                        </span>
                                        {/* Videos */}
                                        <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                                            </svg>
                                            <strong style={{ color: '#fff', fontWeight: 700 }}>{posts.filter(p => p.mediaType === 'video').length}</strong>
                                        </span>
                                        {/* Subscribers — uses totalSubscribers from backend */}
                                        <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <strong style={{ color: '#fff', fontWeight: 700 }}>{totalSubscribers.toLocaleString('en-IN')}</strong>
                                        </span>
                                    </div>

                                    {/* Bio — below stats */}
                                    {bio && <p className="text-surface-300 text-sm mt-3 leading-relaxed max-w-prose">{bio}</p>}
                                </div>

                                {/* ── Premium action buttons ── */}
                                <style>{`
                                    @keyframes btnShine { 0% { left: -100%; } 100% { left: 200%; } }
                                    @keyframes pulseGlow { 0%,100% { box-shadow: 0 8px 32px rgba(168,85,247,0.4); } 50% { box-shadow: 0 12px 40px rgba(168,85,247,0.6); } }
                                    .creator-btn-stack { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
                                    .creator-btn-row { display: flex; gap: 10px; width: 100%; }
                                    .creator-btn-row > * { flex: 1; min-width: 0; }
                                    @media (max-width: 360px) {
                                        .creator-btn-primary { height: 48px !important; font-size: 15px !important; }
                                        .creator-btn-secondary { height: 46px !important; font-size: 13px !important; }
                                    }
                                `}</style>
                                <div className="creator-btn-stack">

                                    {/* 1. Subscribe / Subscribed / Own Profile — full-width hero button */}
                                    {isOwnProfile && !isPreview ? (
                                        // Creator viewing their own profile — no subscribe button
                                        <div className="creator-btn-primary" style={{
                                            width: '100%', height: 54, borderRadius: 16,
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1.5px solid rgba(255,255,255,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: 8, userSelect: 'none',
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 15 }}>Your Profile</span>
                                        </div>
                                    ) : isSubscribed ? (
                                        <div className="creator-btn-primary" style={{
                                            width: '100%', height: 54, borderRadius: 16,
                                            background: 'linear-gradient(135deg, rgba(74,222,128,0.06), rgba(74,222,128,0.02))',
                                            border: '1.5px solid rgba(74,222,128,0.22)',
                                            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: 10, userSelect: 'none',
                                        }}>
                                            <div style={{
                                                width: 24, height: 24, borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 10px rgba(34,197,94,0.4)',
                                                flexShrink: 0,
                                            }}>
                                                <svg width="13" height="13" viewBox="0 0 20 20" fill="#fff">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>Subscribed</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleSubscribe}
                                            disabled={subscribing}
                                            className="creator-btn-primary"
                                            style={{
                                                position: 'relative', overflow: 'hidden',
                                                width: '100%', height: 54, borderRadius: 16, border: 'none',
                                                background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 50%, #f97316 100%)',
                                                color: '#fff',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0 20px',
                                                cursor: subscribing ? 'not-allowed' : 'pointer',
                                                opacity: subscribing ? 0.6 : 1,
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                                animation: 'pulseGlow 3s ease-in-out infinite',
                                            }}
                                            onMouseEnter={e => { if (!subscribing) { e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; } }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
                                        >
                                            {/* Shine sweep animation */}
                                            <div style={{
                                                position: 'absolute', top: 0, left: '-100%',
                                                width: '60%', height: '100%',
                                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                                                animation: 'btnShine 3s ease-in-out infinite',
                                                pointerEvents: 'none',
                                            }} />
                                            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.03em', position: 'relative', zIndex: 1, whiteSpace: 'nowrap' }}>
                                                {subscribing ? 'Processing…' : '⚡ Subscribe Now'}
                                            </span>
                                            {!subscribing && subscriptionPrice > 0 && (
                                                <span style={{
                                                    background: 'rgba(0,0,0,0.25)',
                                                    backdropFilter: 'blur(8px)',
                                                    borderRadius: 12, padding: '5px 14px',
                                                    fontWeight: 800, fontSize: 13,
                                                    letterSpacing: '-0.01em',
                                                    position: 'relative', zIndex: 1,
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                }}>
                                                    ₹{subscriptionPrice}/mo
                                                </span>
                                            )}
                                        </button>
                                    )}

                                    {/* 2. Secondary buttons row: Gift + Chat — only for non-own profiles */}
                                    <div className="creator-btn-row">
                                        {/* Gift button — hidden on own profile */}
                                        {!isOwnProfile && (
                                        <button
                                            onClick={() => setShowGift(true)}
                                            className="creator-btn-secondary"
                                            style={{
                                                height: 50, borderRadius: 14,
                                                background: 'linear-gradient(135deg, rgba(255,122,24,0.1), rgba(255,179,71,0.05))',
                                                border: '1.5px solid rgba(255,122,24,0.25)',
                                                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                                color: '#fff', fontWeight: 700, fontSize: 14,
                                                cursor: 'pointer', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', gap: 6,
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                letterSpacing: '-0.01em',
                                                whiteSpace: 'nowrap',
                                                width: '100%',
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,122,24,0.2), rgba(255,179,71,0.12))';
                                                e.currentTarget.style.borderColor = 'rgba(255,122,24,0.45)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,122,24,0.2)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,122,24,0.1), rgba(255,179,71,0.05))';
                                                e.currentTarget.style.borderColor = 'rgba(255,122,24,0.25)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            <span style={{ fontSize: 18, flexShrink: 0 }}>🎁</span>
                                            <span>Send Gift</span>
                                        </button>
                                        )}

                                        {/* Chat button */}
                                        <ChatButton
                                            creatorId={creator?.userId || creator?._id}
                                            creatorName={displayName}
                                            isSubscribed={isSubscribed}
                                            variant="profile"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* ── Tabs ─────────────────────────────────────────── */}
                            <div className="mt-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <div className="flex">
                                    {TABS.map((tab) => (
                                        <button key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            style={{
                                                flex: 1,
                                                padding: '14px 8px',
                                                fontSize: 15,
                                                fontWeight: activeTab === tab ? 800 : 600,
                                                letterSpacing: '-0.01em',
                                                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                                                background: 'none',
                                                border: 'none',
                                                borderBottom: activeTab === tab ? '3px solid #ec4899' : '3px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'color 0.15s ease, border-color 0.15s ease',
                                                textAlign: 'center',
                                            }}
                                            onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                                            onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                                        >
                                            {tab}{tab === 'Posts' && ` (${posts.length})`}
                                            {tab === 'Media' && ` (${posts.filter((p) => p.mediaUrl || p.mediaUrls?.length).length})`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Post feed / Media grid ───────────────────────── */}
                            <div className="px-4 sm:px-6 mt-4">
                                {activeTab === 'Store' ? (
                                    <div className="text-center py-16 text-surface-500">
                                        <div className="text-4xl mb-3">🛍️</div>
                                        <p>Store coming soon.</p>
                                    </div>
                                ) : activeTab === 'Media' ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {filteredPosts.length === 0 && !loadingPosts && (
                                            <p className="col-span-full text-center py-12 text-surface-500">No media yet.</p>
                                        )}
                                        {filteredPosts.map((p, i) => {
                                            const locked = p.isLocked && !isSubscribed;
                                            const src = Array.isArray(p.mediaUrls) ? p.mediaUrls[0] : p.mediaUrl;
                                            const isVid = p.mediaType === 'video';
                                            return (
                                                <div key={p._id}
                                                    onClick={() => !locked && setModalIndex(posts.indexOf(p))}
                                                    className={`relative aspect-square bg-surface-900 rounded-xl overflow-hidden group ${!locked ? 'cursor-pointer' : ''}`}>
                                                    {/* Media element */}
                                                    {src && (isVid ? (
                                                        <>
                                                            <video
                                                                src={src}
                                                                className={`w-full h-full object-cover transition-all ${locked ? 'blur-xl brightness-75 scale-110' : 'group-hover:scale-105'}`}
                                                                muted playsInline preload="metadata"
                                                            />
                                                            {/* Play icon overlay */}
                                                            {!locked && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                                                                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                                                            <polygon points="5 3 19 12 5 21 5 3" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <img src={src} alt="" loading="lazy"
                                                            className={`w-full h-full object-cover transition-all ${locked ? 'blur-xl brightness-75 scale-110' : 'group-hover:scale-105'}`} />
                                                    ))}

                                                    {/* Locked overlay */}
                                                    {locked && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                            <div className="text-center">
                                                                <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mx-auto mb-1">
                                                                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                                                </div>
                                                                <p className="text-white text-xs font-semibold">Locked</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Video play badge */}
                                                    {!locked && isVid && (
                                                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                                            <span className="text-white text-[10px] font-medium">VIDEO</span>
                                                        </div>
                                                    )}

                                                    {/* Album badge */}
                                                    {!locked && p.mediaType === 'album' && p.mediaUrls?.length > 1 && (
                                                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                            </svg>
                                                            <span className="text-white text-[10px] font-medium">{p.mediaUrls.length}</span>
                                                        </div>
                                                    )}

                                                    {/* Hover overlay */}
                                                    {!locked && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
                                                            {isVid ? (
                                                                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Posts feed */
                                    <div>
                                        {loadingPosts
                                            ? Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="glass rounded-2xl border border-white/5 overflow-hidden mb-4">
                                                    <div className="flex items-center gap-3 px-4 py-3">
                                                        <div className="skeleton w-10 h-10 rounded-full" />
                                                        <div className="skeleton h-4 w-32" />
                                                    </div>
                                                    <div className="skeleton aspect-[4/3]" />
                                                </div>
                                            ))
                                            : filteredPosts.length === 0
                                                ? <p className="text-center py-16 text-surface-500">No posts yet.</p>
                                                : filteredPosts.map((p, i) => (
                                                    <PostCard key={p._id} post={p} creator={creator} isSubscribed={isSubscribed} onSubscribe={handleSubscribe}
                                                        currentUser={user} onGate={() => setShowGate(true)}
                                                        onClick={() => !(p.isLocked && !isSubscribed) && setModalIndex(posts.indexOf(p))} />
                                                ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT: Suggested creators sidebar (2 visible + swipe) ──── */}
                        <div className="w-full lg:w-72 xl:w-80 shrink-0 px-4 lg:px-0 pt-4 lg:pt-[4.5rem]">
                            <div className="glass rounded-2xl border border-white/5 p-4 sticky top-20">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-white">Suggested Creators</h3>
                                    {suggested.length > 2 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setSugIdx(i => Math.max(0, i - 2))}
                                                disabled={sugIdx <= 0}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                                                style={{ background: 'rgba(255,255,255,0.06)' }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setSugIdx(i => Math.min(suggested.length - 2, i + 2))}
                                                disabled={sugIdx >= suggested.length - 2}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                                                style={{ background: 'rgba(255,255,255,0.06)' }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {suggested.length === 0 ? (
                                    <p className="text-surface-600 text-xs">No suggestions yet.</p>
                                ) : (
                                    <div className="flex flex-col gap-2 overflow-hidden">
                                        {suggested.slice(sugIdx, sugIdx + 2).map((c) => <SuggestedCard key={c._id} creator={c} />)}
                                    </div>
                                )}
                                <Link to="/explore" className="block text-center text-xs text-brand-400 hover:text-brand-300 mt-4 transition-colors">
                                    Browse all creators →
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── Media Modal ────────────────────────────────────────────── */}
            {modalIndex >= 0 && (
                <PostLightbox
                    posts={posts.filter(p => !p.isLocked || isSubscribed)}
                    currentIndex={(() => {
                        const viewable = posts.filter(p => !p.isLocked || isSubscribed);
                        const actualPost = posts[modalIndex];
                        return Math.max(0, viewable.findIndex(p => p._id === actualPost?._id));
                    })()}
                    creator={creator}
                    onClose={() => setModalIndex(-1)}
                    currentUser={user}
                    isSubscribed={isSubscribed}
                    onGate={() => setShowGate(true)}
                />
            )}

            {/* ── Subscribe Gate Modal ─────────────────────────────────── */}
            {showGate && (
                <SubscribeGateModal
                    creatorName={creator?.displayName}
                    creatorUsername={creator?.username}
                    onClose={() => setShowGate(false)}
                />
            )}

            {/* ── Gift Modal ────────────────────────────────────────────── */}
            {showGift && (
                <GiftModal
                    creatorId={creator?.userId || creator?._id}
                    creatorName={creator?.displayName}
                    onClose={() => setShowGift(false)}
                    onSuccess={() => setShowGift(false)}
                />
            )}
        </>
    );
}
