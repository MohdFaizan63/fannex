import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { creatorService } from '../../services/creatorService';
import postService from '../../services/postService';
import payoutService from '../../services/payoutService';
import chatService from '../../services/chatService';
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

// ── Mini post row with 3-dot menu ──────────────────────────────────────────────
function PostRow({ post, onClick, onEdit, onDelete }) {
    const mediaUrl = Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : post.mediaUrl;
    const isVideo = post.mediaType === 'video';
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuOpen]);

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.03] rounded-xl px-2 -mx-2 transition-all group">
            <div
                onClick={() => onClick(post)}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-surface-700 flex-shrink-0 relative cursor-pointer"
            >
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

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onClick(post)}>
                <p className="text-sm font-medium text-white truncate">{post.caption || 'Untitled post'}</p>
                <p className="text-xs text-surface-500 mt-0.5">{formatDate(post.createdAt)}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2.5 text-xs text-surface-500 flex-shrink-0">
                {/* Likes */}
                <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    <span className="text-white/60 font-medium">{post.likesCount ?? 0}</span>
                </span>

                {/* Comments */}
                <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <span className="text-white/60 font-medium">{post.commentsCount ?? 0}</span>
                </span>

                {/* Lock / Globe */}
                {post.isLocked ? (
                    <svg className="w-3.5 h-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                ) : (
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                )}
            </div>

            {/* 3-dot menu */}
            <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-white hover:bg-white/10 transition-all"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-9 z-50 w-44 bg-surface-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(post); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2.5"
                        >
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                            Edit Caption
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(post); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all flex items-center gap-2.5"
                        >
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            Delete Post
                        </button>
                    </div>
                )}
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

    // Post management state
    const [editingPost, setEditingPost] = useState(null);
    const [editCaption, setEditCaption] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [deletingPost, setDeletingPost] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Chat settings state
    const [chatSettings, setChatSettings] = useState({ chatEnabled: true, chatPrice: 299, messagePrice: 20 });
    const [msgPriceInput, setMsgPriceInput] = useState('');
    const [chatSaving, setChatSaving] = useState(false);
    const [chatSaved, setChatSaved] = useState(false);

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

                // Load chat settings
                try {
                    const { data } = await chatService.getChatSettings();
                    const s = data.data;
                    setChatSettings({ chatEnabled: s.chatEnabled, chatPrice: s.chatPrice, messagePrice: s.messagePrice ?? 20 });
                    setMsgPriceInput(String(s.messagePrice ?? 20));
                } catch (_) { }
            } finally {
                setLoading(false);
            }
        };
        if (user?._id) loadAll();
    }, [user?._id]);

    // ── Post management handlers ─────────────────────────────────────────────
    const handleEditCaption = async () => {
        if (!editingPost) return;
        setEditSaving(true);
        try {
            await postService.updateCaption(editingPost._id, editCaption);
            setPosts(prev => prev.map(p => p._id === editingPost._id ? { ...p, caption: editCaption } : p));
            setEditingPost(null);
        } catch (_) { }
        setEditSaving(false);
    };

    const handleDeletePost = async () => {
        if (!deletingPost) return;
        setDeleteLoading(true);
        try {
            await postService.delete(deletingPost._id);
            setPosts(prev => prev.filter(p => p._id !== deletingPost._id));
            // Keep the Total Posts stat card in sync without requiring a page reload
            setProfile(prev => prev ? { ...prev, totalPosts: Math.max(0, (prev.totalPosts ?? 0) - 1) } : prev);
            setDeletingPost(null);
        } catch (_) { }
        setDeleteLoading(false);
    };

    // ── Chat settings handler ────────────────────────────────────────────────
    const handleSaveChatSettings = async (newSettings) => {
        setChatSaving(true);
        try {
            const { data } = await chatService.updateChatSettings(newSettings);
            const d = data.data;
            setChatSettings(d);
            setMsgPriceInput(String(d.messagePrice ?? 20));
            setChatSaved(true);
            setTimeout(() => setChatSaved(false), 2000);
        } catch (_) { }
        setChatSaving(false);
    };

    const stats = [
        { icon: '👥', label: 'Total Subscribers', value: loading ? '—' : (profile?.totalSubscribers ?? 0).toLocaleString('en-IN') },
        { icon: '💰', label: 'Total Earned', value: loading ? '—' : formatCurrency(earnings?.totalEarned ?? 0), accent: true, sub: 'lifetime' },
        { icon: '⏳', label: 'Pending Payout', value: loading ? '—' : formatCurrency(earnings?.pendingAmount ?? 0), sub: 'withdrawable' },
        { icon: '📸', label: 'Total Posts', value: loading ? '—' : (profile?.totalPosts ?? 0).toLocaleString('en-IN') },
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
                            🏦 Bank Details
                        </Link>
                    </div>
                </div>

                {/* ── Mobile-only action buttons row ────────────────────────── */}
                <div className="sm:hidden flex flex-wrap gap-2 mb-5">
                    <button onClick={() => setShowEditProfile(true)} className="flex-1 btn-outline text-sm py-2 rounded-xl min-w-[120px]">
                        ✏️ Edit Profile
                    </button>
                    <Link to="/payout-settings" className="flex-1 btn-outline text-sm py-2 rounded-xl min-w-[120px] text-center">
                        🏦 Bank Details
                    </Link>
                </div>

                {/* ── Profile link ──────────────────────────────────────────── */}
                {profileUrl ? (
                    <div className="mb-6 rounded-2xl p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {/* Link row */}
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-base shrink-0">🔗</span>
                            <a href={profileUrl} target="_blank" rel="noreferrer"
                                className="flex-1 min-w-0 text-xs text-brand-400 hover:text-brand-300 font-mono"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {profileUrl}
                            </a>
                            <button
                                onClick={handleCopy}
                                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold transition-all"
                                style={{
                                    background: copied ? 'rgba(34,197,94,0.15)' : '#1e1e1e',
                                    color: copied ? '#4ade80' : '#a1a1aa',
                                    borderRadius: '10px',
                                    padding: '8px 14px',
                                    border: copied ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.07)',
                                }}
                                onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = '#242424'; }}
                                onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = '#1e1e1e'; }}
                            >
                                {copied ? '✓ Copied' : '⎘ Copy'}
                            </button>
                        </div>
                        {/* View Profile button — opens public fan view in a new tab */}
                        <a href={`${profileUrl}?preview=true`} target="_blank" rel="noreferrer"
                            className="flex items-center justify-center w-full gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                            style={{
                                height: '40px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                            👁 View Profile
                        </a>
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
                <div className="glass rounded-2xl border border-brand-500/20 p-4 sm:p-5 mb-4 flex items-center gap-3">
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

                {/* ── Profile Insights button ──────────────────────────────────── */}
                <Link
                    to="/insights"
                    className="glass rounded-2xl border border-emerald-500/20 p-4 sm:p-5 mb-6 flex items-center gap-3 group hover:border-emerald-500/40 transition-all cursor-pointer block"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-500/20 flex items-center justify-center text-lg flex-shrink-0">
                        📈
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm group-hover:text-emerald-300 transition-colors">Profile Insights</p>
                        <p className="text-surface-400 text-xs mt-0.5">
                            Track visits, earnings & growth
                        </p>
                    </div>
                    <div className="flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-emerald-500/40 text-emerald-300 group-hover:bg-emerald-500/10 transition-all">
                        📊 <span className="hidden sm:inline">View </span>Stats
                    </div>
                </Link>

                {/* ── Chat Settings card ────────────────────────────────────── */}
                <div className="glass rounded-2xl border border-violet-500/20 p-4 sm:p-5 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-600/30 border border-violet-500/20 flex items-center justify-center text-lg flex-shrink-0">💬</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm">Chat Settings</p>
                            <p className="text-surface-400 text-xs mt-0.5">
                                {chatSettings.chatEnabled
                                    ? `₹${chatSettings.chatPrice} unlock · ₹${chatSettings.messagePrice ?? 20}/msg`
                                    : 'Chat disabled'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {chatSaved && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">✓ Saved</span>}
                            <Link to="/creator/chat" className="text-xs text-violet-400 hover:text-violet-300 font-medium">Inbox →</Link>
                        </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => handleSaveChatSettings({ chatEnabled: !chatSettings.chatEnabled })}
                            disabled={chatSaving}
                            className="flex items-center gap-2 text-sm"
                        >
                            <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${chatSettings.chatEnabled ? 'bg-green-500' : 'bg-surface-600'}`}>
                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${chatSettings.chatEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                            </div>
                            <span className={`font-medium ${chatSettings.chatEnabled ? 'text-green-400' : 'text-surface-500'}`}>
                                {chatSettings.chatEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </button>
                    </div>

                    {/* Price inputs */}
                    {chatSettings.chatEnabled && (
                        <div className="flex flex-col gap-3">
                            {/* Message price */}
                            <div className="flex items-center gap-2">
                                <span className="text-surface-500 text-xs font-medium w-16 shrink-0">Per msg</span>
                                <span className="text-surface-400 text-sm">₹</span>
                                <input
                                    type="number" min="1"
                                    value={msgPriceInput}
                                    onChange={(e) => setMsgPriceInput(e.target.value)}
                                    className="input-dark w-20 text-sm py-1.5"
                                    placeholder="20"
                                />
                                <button
                                    onClick={() => { const p = Number(msgPriceInput); if (p > 0) handleSaveChatSettings({ messagePrice: p }); }}
                                    disabled={chatSaving || Number(msgPriceInput) === (chatSettings.messagePrice ?? 20)}
                                    className="btn-outline text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                                >
                                    {chatSaving ? '…' : 'Update'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Recent posts + subscribers ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Recent posts */}
                    <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-white text-sm sm:text-base">Recent Posts</h2>
                            <div className="flex items-center gap-3">
                                <Link to="/upload" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">+ New</Link>
                                <Link to="/all-posts" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">View all →</Link>
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
                                : posts.map((p, i) => (
                                    <PostRow
                                        key={p._id}
                                        post={p}
                                        onClick={() => setLightboxIdx(i)}
                                        onEdit={(post) => { setEditingPost(post); setEditCaption(post.caption || ''); }}
                                        onDelete={(post) => setDeletingPost(post)}
                                    />))
                        }
                        {posts.length >= RECENT_LIMIT && (
                            <Link to={profile?.username ? `/creator/${profile.username}` : '#'} className="block mt-3 text-center text-xs text-brand-400 hover:text-brand-300 py-2 border-t border-white/5">
                                View all posts →
                            </Link>
                        )}
                    </div>

                    {/* Recent subscribers */}
                    <div className="glass rounded-2xl p-4 sm:p-5 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-white text-sm sm:text-base">Recent Subscribers</h2>
                            <Link to="/subscribers" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">View all →</Link>
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

            {/* ── Edit Caption Modal ───────────────────────────────────── */}
            {editingPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-1">Edit Caption</h2>
                        <p className="text-surface-400 text-xs mb-4 truncate">Post: {editingPost.caption || 'Untitled'}</p>
                        <textarea
                            value={editCaption}
                            onChange={(e) => setEditCaption(e.target.value)}
                            rows={3}
                            className="input-dark w-full mb-4 resize-none"
                            placeholder="Write a caption…"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleEditCaption}
                                disabled={editSaving}
                                className="btn-brand flex-1 py-2 text-sm"
                            >
                                {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                onClick={() => setEditingPost(null)}
                                className="btn-outline flex-1 py-2 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ────────────────────────────── */}
            {deletingPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass rounded-2xl border border-red-500/20 p-6 w-full max-w-sm shadow-2xl">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🗑️</span>
                        </div>
                        <h2 className="text-lg font-bold text-white text-center mb-2">Delete Post?</h2>
                        <p className="text-surface-400 text-sm text-center mb-6">
                            Are you sure you want to delete this post? This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDeletePost}
                                disabled={deleteLoading}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                            <button
                                onClick={() => setDeletingPost(null)}
                                className="btn-outline flex-1 py-2.5 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
