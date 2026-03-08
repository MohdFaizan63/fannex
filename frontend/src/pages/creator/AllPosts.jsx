import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import postService from '../../services/postService';
import { formatDate } from '../../utils/helpers';
import PostLightbox from '../../components/PostLightbox';
import api from '../../services/api';

const LIMIT = 20;

export default function AllPosts() {
    const { user } = useAuth();

    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [lightboxIdx, setLightboxIdx] = useState(-1);
    const [profile, setProfile] = useState(null);

    // Load creator profile for lightbox
    useEffect(() => {
        api.get('/creator/status').then(({ data }) => setProfile(data.data)).catch(() => { });
    }, []);

    const load = useCallback(async (p) => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const { data } = await postService.getByCreator(user._id, { page: p, limit: LIMIT, sort: '-createdAt' });
            setPosts(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotal(data.total ?? data.results?.length ?? 0);
        } catch (_) { }
        setLoading(false);
    }, [user?._id]);

    useEffect(() => { load(page); }, [page, load]);

    // Delete handler
    const handleDelete = async (post) => {
        if (!window.confirm('Delete this post? This cannot be undone.')) return;
        try {
            await postService.delete(post._id);
            setPosts(prev => prev.filter(p => p._id !== post._id));
            setTotal(t => Math.max(0, t - 1));
        } catch (_) { }
    };

    return (
        <div className="p-4 sm:p-6 w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-white">All Posts</h1>
                    <p className="text-surface-400 text-sm mt-0.5">
                        {loading ? '…' : `${total} post${total !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/upload" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                        + New Post
                    </Link>
                    <Link to="/dashboard" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                        ← Dashboard
                    </Link>
                </div>
            </div>

            {/* Posts list */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0">
                            <div className="skeleton w-14 h-14 rounded-xl flex-shrink-0" />
                            <div className="flex-1"><div className="skeleton h-4 w-32 mb-1" /><div className="skeleton h-3 w-20" /></div>
                        </div>
                    ))
                ) : posts.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-4xl mb-3">📸</div>
                        <p className="text-surface-500 text-sm mb-4">No posts yet.</p>
                        <Link to="/upload" className="btn-brand text-sm px-6 py-2.5 rounded-xl">Create your first post</Link>
                    </div>
                ) : (
                    posts.map((p, i) => {
                        const mediaUrl = Array.isArray(p.mediaUrls) ? p.mediaUrls[0] : p.mediaUrl;
                        const isVideo = p.mediaType === 'video';
                        const isAlbum = p.mediaType === 'album' && p.mediaUrls?.length > 1;

                        return (
                            <div key={p._id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group">
                                {/* Thumbnail */}
                                <div
                                    onClick={() => setLightboxIdx(i)}
                                    className="w-14 h-14 rounded-xl overflow-hidden bg-surface-700 flex-shrink-0 relative cursor-pointer"
                                >
                                    {mediaUrl ? (
                                        isVideo ? (
                                            <>
                                                <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                                                <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 text-white px-1 rounded font-semibold">VID</span>
                                            </>
                                        ) : (
                                            <img src={mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-surface-500 text-lg">🖼️</div>
                                    )}
                                    {isAlbum && (
                                        <span className="absolute top-0.5 right-0.5 text-[8px] bg-black/70 text-white px-1 rounded font-semibold">{p.mediaUrls.length}</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLightboxIdx(i)}>
                                    <p className="text-sm font-semibold text-white truncate">{p.caption || 'Untitled post'}</p>
                                    <p className="text-xs text-surface-500 mt-0.5">{formatDate(p.createdAt)}</p>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-2.5 text-xs flex-shrink-0">
                                    <span className="flex items-center gap-1 text-rose-400">
                                        ❤️ <span className="text-white/60 font-medium">{p.likesCount ?? 0}</span>
                                    </span>
                                    <span className="flex items-center gap-1 text-sky-400">
                                        💬 <span className="text-white/60 font-medium">{p.commentsCount ?? 0}</span>
                                    </span>
                                    {p.isLocked ? (
                                        <span className="text-brand-400 text-[10px]">🔒</span>
                                    ) : (
                                        <span className="text-emerald-400 text-[10px]">🌐</span>
                                    )}
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="btn-outline text-xs px-4 py-2 rounded-xl disabled:opacity-30"
                    >
                        ← Prev
                    </button>
                    <span className="text-xs text-surface-400 font-medium">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="btn-outline text-xs px-4 py-2 rounded-xl disabled:opacity-30"
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Lightbox */}
            {lightboxIdx >= 0 && (
                <PostLightbox
                    posts={posts}
                    currentIndex={lightboxIdx}
                    creator={profile}
                    onClose={() => setLightboxIdx(-1)}
                    onChange={setLightboxIdx}
                />
            )}
        </div>
    );
}
