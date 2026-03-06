import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { creatorService } from '../../services/creatorService';
import postService from '../../services/postService';
import payoutService from '../../services/payoutService';
import { formatCurrency, formatDate } from '../../utils/helpers';
import api from '../../services/api';
import EditCreatorProfileModal from '../../components/EditCreatorProfileModal';
import PostLightbox from '../../components/PostLightbox';

const RECENT_LIMIT = 10; // show 10 items, then "View All" link

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent = false }) {
    return (
        <div className={`glass rounded-2xl p-4 sm:p-5 border transition-all ${accent ? 'border-brand-500/30' : 'border-white/5'}`}>
            <div className="flex items-start justify-between mb-2">
                <span className="text-xl sm:text-2xl">{icon}</span>
                {sub && <span className="text-[10px] text-surface-500 bg-surface-700/50 px-2 py-0.5 rounded-full">{sub}</span>}
            </div>
            <p className={`text-xl sm:text-2xl font-black mb-1 ${accent ? 'gradient-text' : 'text-white'}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-widest text-surface-500 font-medium">{label}</p>
        </div>
    );
}

// ── Mini post row ──────────────────────────────────────────────────────────────
function PostRow({ post, onClick }) {
    const mediaUrl = Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : post.mediaUrl;
    const isVideo = post.mediaType === 'video';

    return (
        <div
            onClick={() => onClick(post)}
            className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03] rounded-xl px-2 -mx-2 transition-all group"
        >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-surface-700 flex-shrink-0 relative">
                {mediaUrl ? (
                    isVideo ? (
                        <>
                            <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 text-white px-1 rounded">VID</span>
                        </>
                    ) : (
                        <img src={mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { e.target.style.display = 'none'; }} />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500 text-lg">🖼️</div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{post.caption || 'Untitled post'}</p>
                <p className="text-xs text-surface-500 mt-0.5">{formatDate(post.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-surface-500 flex-shrink-0">
                <span>❤️ {post.likesCount ?? 0}</span>
                <span>💬 {post.commentsCount ?? 0}</span>
                {post.isLocked ? <span className="text-brand-400">🔒</span> : <span className="text-green-400">🌐</span>}
            </div>
        </div>
    );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
    const { user } = useAuth();

    const [earnings, setEarnings] = useState(null);
    const [posts, setPosts] = useState([]);
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showChangePlan, setShowChangePlan] = useState(false);
    const [planPrice, setPlanPrice] = useState('');
    const [planSaving, setPlanSaving] = useState(false);
    const [planError, setPlanError] = useState('');
    const [lightboxIdx, setLightboxIdx] = useState(-1);

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            try {
                const [earningsRes, postsRes, subsRes] = await Promise.allSettled([
                    payoutService.getEarnings(),
                    postService.getByCreator(user?._id, { limit: RECENT_LIMIT, sort: '-createdAt' }),
                    creatorService.mySubscribers({ limit: RECENT_LIMIT, sort: '-createdAt' }),
                ]);

                if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value.data?.data);
                if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data?.results ?? []);
                if (subsRes.status === 'fulfilled') setSubs(subsRes.value.data?.results ?? []);

                try {
                    const { data } = await api.get('/creator/status');
                    setProfile(data.data);
                } catch (_) { }
            } finally {
                setLoading(false);
            }
        };
        if (user?._id) loadAll();
    }, [user?._id]);

    const stats = [
        { icon: '👥', label: 'Total Subscribers', value: loading ? '—' : (profile?.totalSubscribers ?? 0).toLocaleString('en-IN') },
        { icon: '💰', label: 'Total Earned', value: loading ? '—' : formatCurrency(earnings?.totalEarned ?? 0), accent: true, sub: 'lifetime' },
        { icon: '⏳', label: 'Pending Payout', value: loading ? '—' : formatCurrency(earnings?.pendingAmount ?? 0), sub: 'withdrawable' },
        { icon: '📸', label: 'Total Posts', value: loading ? '—' : (profile?.totalPosts ?? posts.length).toLocaleString('en-IN') },
    ];

    const profileUrl = profile?.username ? `${window.location.origin}/creator/${profile.username}` : null;

    const handleCopy = async () => {
        if (!profileUrl) return;
        try { await navigator.clipboard.writeText(profileUrl); } catch (_) { }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <>
            <div className="p-4 sm:p-6 w-full">

                {/* Edit Profile Modal */}
                {showEditProfile && (
                    <EditCreatorProfileModal
                        profile={profile}
                        onClose={() => setShowEditProfile(false)}
                        onSaved={(updated) => setProfile(prev => ({ ...prev, ...updated }))}
                    />
                )}

                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="mb-5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-white">Dashboard</h1>
                        <p className="text-surface-400 mt-0.5 text-sm">
                            Welcome back, <span className="text-brand-400">{user?.name}</span>
                        </p>
                    </div>
                    {/* Desktop-only edit buttons in header */}
                    <div className="hidden sm:flex items-center gap-2">
                        <button onClick={() => setShowEditProfile(true)} className="btn-outline text-sm px-4 py-2 rounded-xl flex items-center gap-1.5">
                            ✏️ Edit Profile
                        </button>
                        <Link to="/payout-settings" className="btn-outline text-sm px-4 py-2 rounded-xl flex items-center gap-1.5">
                            💳 Payout Settings
                        </Link>
                    </div>
                </div>

                {/* ── Mobile-only action buttons row ────────────────────────── */}
                <div className="sm:hidden flex flex-wrap gap-2 mb-5">
                    <button onClick={() => setShowEditProfile(true)} className="flex-1 btn-outline text-sm py-2 rounded-xl min-w-[120px]">
                        ✏️ Edit Profile
                    </button>
                    <Link to="/payout-settings" className="flex-1 btn-outline text-sm py-2 rounded-xl min-w-[120px] text-center">
                        💳 Payout
                    </Link>
                </div>

                {/* ── Profile link ──────────────────────────────────────────── */}
                {profileUrl ? (
                    <div className="glass rounded-2xl border border-white/5 px-4 py-3 mb-6 flex items-center gap-2">
                        <span className="text-base flex-shrink-0">🔗</span>
                        <a href={profileUrl} target="_blank" rel="noreferrer"
                            className="flex-1 text-xs sm:text-sm text-brand-400 hover:text-brand-300 truncate font-mono">
                            {profileUrl}
                        </a>
                        <button onClick={handleCopy}
                            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white border border-white/5'
                                }`}>
                            {copied ? '✓ Copied' : '⎘ Copy'}
                        </button>
                    </div>
                ) : (
                    !loading && (
                        <div className="glass rounded-2xl border border-amber-500/20 px-4 py-3 mb-6 flex items-center gap-3 text-sm">
                            <span>⚠️</span>
                            <span className="text-amber-400 text-xs sm:text-sm">Your profile link will appear after verification is approved.</span>
                        </div>
                    )
                )}

                {/* ── Stats grid — 2×2 ───────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {stats.map((s) => (
                        loading
                            ? <div key={s.label} className="glass rounded-2xl p-4 border border-white/5 animate-pulse">
                                <div className="skeleton w-7 h-7 rounded-lg mb-2" />
                                <div className="skeleton h-6 w-20 mb-1" />
                                <div className="skeleton h-2.5 w-14" />
                            </div>
                            : <StatCard key={s.label} {...s} />
                    ))}
                </div>

                {/* ── Quick actions ──────────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <Link to="/upload" className="btn-brand text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl text-center">
                        ➕ <span className="hidden sm:inline">New </span>Post
                    </Link>
                    <Link to="/earnings" className="btn-outline text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl text-center">
                        💰 <span className="hidden sm:inline">Request </span>Payout
                    </Link>
                    <Link to="/creator/chat" className="btn-outline text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl text-center">
                        💬 <span className="hidden sm:inline">Chat </span>Inbox
                    </Link>
                </div>

                {/* ── Change Plan modal ──────────────────────────────────────── */}
                {showChangePlan && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
                            <h2 className="text-lg font-bold text-white mb-1">Change Subscription Price</h2>
                            <p className="text-surface-400 text-xs mb-5">Current: ₹{profile?.subscriptionPrice ?? 0}/month</p>
                            {planError && <p className="mb-3 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{planError}</p>}
                            <label className="block text-sm font-medium text-surface-300 mb-1.5">New Price (₹/month)</label>
                            <input type="number" min="1" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)}
                                placeholder="e.g. 199" className="input-dark w-full mb-5" />
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        const price = Number(planPrice);
                                        if (!price || price < 1) { setPlanError('Enter a valid price'); return; }
                                        setPlanSaving(true); setPlanError('');
                                        try {
                                            const { data } = await api.patch('/creator/profile', { subscriptionPrice: price });
                                            setProfile(prev => ({ ...prev, subscriptionPrice: data.data?.subscriptionPrice ?? price }));
                                            setShowChangePlan(false); setPlanPrice('');
                                        } catch (err) {
                                            setPlanError(err?.response?.data?.message || 'Failed to save.');
                                        } finally { setPlanSaving(false); }
                                    }}
                                    disabled={planSaving}
                                    className="btn-brand flex-1 py-2 text-sm"
                                >
                                    {planSaving ? 'Saving…' : 'Save Price'}
                                </button>
                                <button onClick={() => { setShowChangePlan(false); setPlanPrice(''); setPlanError(''); }} className="btn-outline flex-1 py-2 text-sm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Creator Studio card ───────────────────────────────────── */}
                <div className="glass rounded-2xl border border-brand-500/20 p-4 sm:p-5 mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/30 to-violet-600/30 border border-brand-500/20 flex items-center justify-center text-lg flex-shrink-0">💎</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">Creator Studio</p>
                        <p className="text-surface-400 text-xs mt-0.5">
                            ₹{profile?.subscriptionPrice ?? 199}/month · {profile?.totalSubscribers ?? 0} subscriber{profile?.totalSubscribers !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={() => { setPlanPrice(profile?.subscriptionPrice ?? ''); setPlanError(''); setShowChangePlan(true); }}
                        className="flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-brand-500/40 text-brand-300 hover:bg-brand-500/10 transition-all"
                    >
                        ✏️ <span className="hidden sm:inline">Change </span>Plan
                    </button>
                </div>

                {/* ── Recent posts + subscribers ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Recent posts */}
                    <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-white text-sm sm:text-base">Recent Posts</h2>
                            <div className="flex items-center gap-3">
                                <Link to="/upload" className="text-xs text-brand-400 hover:text-brand-300">+ New</Link>
                                <Link to="/my-posts" className="text-xs text-surface-500 hover:text-surface-300">View all →</Link>
                            </div>
                        </div>
                        {loading
                            ? Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3 py-2.5 border-b border-white/5 last:border-0">
                                    <div className="skeleton w-12 h-12 rounded-lg flex-shrink-0" />
                                    <div className="flex-1"><div className="skeleton h-4 w-32 mb-1" /><div className="skeleton h-3 w-20" /></div>
                                </div>
                            ))
                            : posts.length === 0
                                ? <p className="text-surface-500 text-sm text-center py-8">No posts yet.</p>
                                : posts.map((p, i) => <PostRow key={p._id} post={p} onClick={() => setLightboxIdx(i)} />)
                        }
                        {posts.length >= RECENT_LIMIT && (
                            <Link to="/my-posts" className="block mt-3 text-center text-xs text-brand-400 hover:text-brand-300 py-2 border-t border-white/5">
                                View all posts →
                            </Link>
                        )}
                    </div>

                    {/* Recent subscribers */}
                    <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-white text-sm sm:text-base">Recent Subscribers</h2>
                            <Link to="/subscribers" className="text-xs text-surface-500 hover:text-surface-300">View all →</Link>
                        </div>
                        {loading
                            ? Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3 py-2.5 border-b border-white/5 last:border-0">
                                    <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                                    <div className="flex-1"><div className="skeleton h-4 w-28 mb-1" /><div className="skeleton h-3 w-20" /></div>
                                </div>
                            ))
                            : subs.length === 0
                                ? <p className="text-surface-500 text-sm text-center py-8">No subscribers yet.</p>
                                : subs.map((s) => (
                                    <div key={s._id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                            {s.subscriberId?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{s.subscriberId?.name ?? 'Unknown'}</p>
                                            <p className="text-xs text-surface-500">{formatDate(s.createdAt)}</p>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex-shrink-0">active</span>
                                    </div>
                                ))
                        }
                        {subs.length >= RECENT_LIMIT && (
                            <Link to="/subscribers" className="block mt-3 text-center text-xs text-brand-400 hover:text-brand-300 py-2 border-t border-white/5">
                                View all subscribers →
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Post Lightbox with navigation */}
            {lightboxIdx >= 0 && (
                <PostLightbox
                    posts={posts}
                    currentIndex={lightboxIdx}
                    creator={profile}
                    onClose={() => setLightboxIdx(-1)}
                    onChange={setLightboxIdx}
                />
            )}
        </>
    );
}
