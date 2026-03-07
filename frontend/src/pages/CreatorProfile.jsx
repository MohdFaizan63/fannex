import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
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
                            muted playsInline loop autoPlay={!locked} preload="metadata"
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

// ─── Suggested creator card ───────────────────────────────────────────────────
const GENRE_COLORS = { fitness: 'bg-green-500/20 text-green-400', gaming: 'bg-blue-500/20 text-blue-400', fashion: 'bg-pink-500/20 text-pink-400', education: 'bg-amber-500/20 text-amber-400', art: 'bg-purple-500/20 text-purple-400', music: 'bg-red-500/20 text-red-400', lifestyle: 'bg-cyan-500/20 text-cyan-400' };

function SuggestedCard({ creator }) {
    const genreClass = GENRE_COLORS[creator.genre] || 'bg-surface-700/50 text-surface-400';
    return (
        <Link to={`/creator/${creator.username}`}
            className="glass rounded-xl border border-white/5 hover:border-brand-500/30 transition-all group overflow-hidden">
            {/* Cover / gradient header */}
            <div className="h-16 bg-gradient-to-br from-brand-600/40 via-violet-600/30 to-surface-800 relative">
                {creator.coverImage && (
                    <img src={creator.coverImage} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                )}
            </div>
            {/* Profile section */}
            <div className="px-3 pb-3 -mt-6 relative">
                <div className="flex items-end gap-3">
                    {/* Profile photo — 48px circle */}
                    {creator.profileImage ? (
                        <img src={creator.profileImage} alt={creator.displayName} loading="lazy"
                            className="w-12 h-12 rounded-full object-cover object-top border-2 border-surface-900 shadow-lg flex-shrink-0" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm border-2 border-surface-900 shadow-lg flex-shrink-0">
                            {creator.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 pb-0.5">
                        <p className="text-white text-sm font-semibold truncate">{creator.displayName}</p>
                        <p className="text-surface-500 text-xs truncate">@{creator.username}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-surface-500 text-xs">{(creator.totalSubscribers || 0).toLocaleString()} fans</span>
                        {creator.genre && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${genreClass}`}>{creator.genre}</span>
                        )}
                    </div>
                    <span className="text-[11px] font-semibold text-brand-400 group-hover:text-brand-300 shrink-0 px-2.5 py-1 rounded-full border border-brand-500/30 group-hover:bg-brand-500/10 transition-all">
                        {creator.subscriptionPrice ? `₹${creator.subscriptionPrice}/mo` : 'Follow'}
                    </span>
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

    // ── Load creator profile ─────────────────────────────────────────────────
    useEffect(() => {
        setLoadingProfile(true);
        api.get(`/creator/profile/${usernameParam}`)
            .then(({ data }) => {
                setCreator(data.data);
                setIsSubscribed(data.data.isSubscribed ?? false);
            })
            .catch(() => setError('Creator not found.'))
            .finally(() => setLoadingProfile(false));
    }, [usernameParam]);

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
        api.get('/creator/suggested')
            .then(({ data }) => setSuggested(data.data ?? []))
            .catch(() => { });
    }, [creator?.username]);

    // ── Handle success return from SubscribePage ─────────────────────────────
    const location = useLocation();
    useEffect(() => {
        if (location.state?.subscribed && creator) {
            setIsSubscribed(true);
            const id = creator.userId || creator._id;
            postService.getByCreator(id, { limit: 30 })
                .then(({ data }) => setPosts(data.results ?? []))
                .catch(() => { });
        }
    }, [location.state, creator]);

    // ── Subscribe ────────────────────────────────────────────────────────────
    const handleSubscribe = () => {
        if (isSubscribed) return;
        const username = creator?.username;
        if (!username) return;
        if (!isAuthenticated) {
            // Persist fan intent — survives page load, logout, existing accounts
            localStorage.setItem('fannex_fan_intent', 'true');
            // Smart signup intent tracking — fan account flow
            navigate(
                `/register?from=creator&creator=${encodeURIComponent(username)}&redirect=${encodeURIComponent(`/creator/${username}/subscribe`)}`
            );
        } else {
            navigate(`/creator/${username}/subscribe`);
        }
    };

    const handleShare = async () => {
        const url = window.location.href;
        try { await navigator.clipboard.writeText(url); } catch { }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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

    return (
        <>
            <div className="min-h-screen bg-surface-950">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 lg:items-start px-0 lg:px-4 pb-16">

                        {/* ── LEFT: Main profile ─────────────────────────────────── */}
                        <div className="flex-1 min-w-0">

                            {/* Cover */}
                            <div className="relative h-48 sm:h-64 overflow-hidden bg-surface-800"
                                style={{ background: coverImage ? undefined : 'linear-gradient(135deg,#3a0060,#0d0020 55%,#1a0040)' }}>
                                {coverImage && <img src={coverImage} alt="cover" loading="lazy" className="w-full h-full object-cover"
                                    style={{ objectPosition: `center ${coverImagePosition ?? 50}%` }} />}
                                <div className="absolute inset-x-0 bottom-0 h-24"
                                    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-surface-950,#050208))' }} />
                            </div>

                            {/* Profile header */}
                            <div className="relative z-10 px-4 sm:px-6 -mt-[58px]">
                                <div className="flex items-end justify-between">
                                    {/* Avatar */}
                                    <Avatar src={profileImage} name={displayName} size="lg" objectPosition={profileImagePosition} />

                                    {/* Share icon — top right */}
                                    <button onClick={handleShare}
                                        className="mb-1 p-2.5 rounded-full glass border border-white/10 text-surface-400 hover:text-white hover:border-white/20 transition-all"
                                        title="Share profile">
                                        {copied
                                            ? <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>}
                                    </button>
                                </div>

                                {/* Name + stats — ABOVE buttons */}
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h1 className="text-2xl font-black text-white">{displayName}</h1>
                                        {creator.creatorType === 'ai' && (
                                            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-xs font-semibold">AI</span>
                                        )}
                                    </div>
                                    <p className="text-surface-500 text-sm mt-0.5">@{username}</p>

                                    {bio && <p className="text-surface-300 text-sm mt-3 leading-relaxed max-w-prose">{bio}</p>}

                                    <div className="flex items-center gap-6 mt-3 text-sm">
                                        <span><strong className="text-white">{posts.length}</strong> <span className="text-surface-500">posts</span></span>
                                        <span><strong className="text-white">{totalSubscribers.toLocaleString('en-IN')}</strong> <span className="text-surface-500">subscribers</span></span>
                                    </div>
                                </div>

                                {/* ── Premium action button stack (Fanvue-style) ── */}
                                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>

                                    {/* 1. Subscribe / Subscribed */}
                                    {isSubscribed ? (
                                        /* Subscribed state — clean bordered pill */
                                        <div style={{
                                            width: '100%', height: 58, borderRadius: 999,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1.5px solid rgba(255,255,255,0.14)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            gap: 8, userSelect: 'none',
                                        }}>
                                            <svg width="17" height="17" viewBox="0 0 20 20" fill="#4ade80"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>Subscribed</span>
                                        </div>
                                    ) : (
                                        /* Subscribe — bold Fanvue-style pill: text left + price right */
                                        <button
                                            onClick={handleSubscribe}
                                            disabled={subscribing}
                                            style={{
                                                width: '100%', height: 58, borderRadius: 999, border: 'none',
                                                background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)',
                                                boxShadow: '0 8px 28px rgba(168,85,247,0.45)',
                                                color: '#fff',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0 28px',
                                                cursor: subscribing ? 'not-allowed' : 'pointer',
                                                opacity: subscribing ? 0.6 : 1,
                                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                            }}
                                            onMouseEnter={e => { if (!subscribing) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 10px 34px rgba(168,85,247,0.55)'; } }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(168,85,247,0.45)'; }}
                                        >
                                            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
                                                {subscribing ? 'Processing…' : 'Join now'}
                                            </span>
                                            {!subscribing && subscriptionPrice > 0 && (
                                                <span style={{
                                                    background: 'rgba(0,0,0,0.22)',
                                                    borderRadius: 999, padding: '4px 14px',
                                                    fontWeight: 700, fontSize: 14,
                                                    letterSpacing: '-0.01em',
                                                }}>
                                                    ₹{subscriptionPrice}/mo
                                                </span>
                                            )}
                                        </button>
                                    )}

                                    {/* 2. Secondary buttons row: Gift + Chat */}
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        {/* Gift button */}
                                        <button
                                            onClick={() => setShowGift(true)}
                                            style={{
                                                flex: 1, height: 52, borderRadius: 999,
                                                background: 'rgba(255,255,255,0.07)',
                                                border: '1.5px solid rgba(255,255,255,0.12)',
                                                color: '#fff', fontWeight: 700, fontSize: 15,
                                                cursor: 'pointer', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', gap: 7,
                                                transition: 'background 0.15s ease, border-color 0.15s ease',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                                        >
                                            <span style={{ fontSize: 19 }}>🎁</span>
                                            <span>Gift</span>
                                        </button>

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
                            <div className="px-4 sm:px-6 mt-6">
                                <div className="flex gap-0 border-b border-white/10">
                                    {TABS.map((tab) => (
                                        <button key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab
                                                ? 'border-brand-500 text-brand-400'
                                                : 'border-transparent text-surface-500 hover:text-white'}`}>
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
                                                        <video
                                                            src={src}
                                                            className={`w-full h-full object-cover transition-all ${locked ? 'blur-xl brightness-75 scale-110' : 'group-hover:scale-105'}`}
                                                            muted playsInline loop preload="metadata"
                                                            onMouseEnter={e => !locked && e.target.play().catch(() => { })}
                                                            onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
                                                        />
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

                        {/* ── RIGHT: Suggested creators sidebar ─────────────────── */}
                        <div className="w-full lg:w-72 xl:w-80 shrink-0 px-4 lg:px-0 pt-4 lg:pt-[4.5rem]">
                            <div className="glass rounded-2xl border border-white/5 p-4 sticky top-20">
                                <h3 className="text-sm font-bold text-white mb-3">Suggested Creators</h3>
                                {suggested.length === 0 ? (
                                    <p className="text-surface-600 text-xs">No suggestions yet.</p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {suggested.map((c) => <SuggestedCard key={c._id} creator={c} />)}
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
