import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { creatorService } from '../services/creatorService';

const CATEGORIES = ['All', 'Art', 'Music', 'Gaming', 'Fitness', 'Beauty', 'Education', 'Tech', 'Travel', 'Food'];

// ── Creator card (Fanvue-style full-bleed cover) ──────────────────────────────
function CreatorCard({ creator }) {
    const {
        _id,
        displayName = 'Unknown',
        profileImage,
        coverImage,
        totalSubscribers = 0,
        username,
        subscriptionPrice = 0,
    } = creator;

    return (
        <Link
            to={`/creator/${username || _id}`}
            className="block group"
            style={{ textDecoration: 'none' }}
        >
            <div style={{
                position: 'relative',
                height: 180,
                borderRadius: 16,
                overflow: 'hidden',
                background: 'linear-gradient(135deg,#2d0050,#0d0020)',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; }}
            >
                {/* Cover photo */}
                {coverImage ? (
                    <img src={coverImage} alt="cover" loading="lazy"
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
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                    <span style={{
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        color: '#fff',
                        fontSize: 12, fontWeight: 700,
                        padding: '5px 13px', borderRadius: 999,
                    }}>
                        {subscriptionPrice > 0 ? `₹${subscriptionPrice}/mo` : 'Free'}
                    </span>
                </div>

                {/* Bottom: avatar + name overlaid */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    {/* Avatar */}
                    {profileImage ? (
                        <img src={profileImage} alt={displayName} loading="lazy"
                            style={{
                                width: 52, height: 52, borderRadius: '50%',
                                objectFit: 'cover', flexShrink: 0,
                                border: '3px solid rgba(255,255,255,0.85)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                            }} />
                    ) : (
                        <div style={{
                            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: 18,
                            border: '3px solid rgba(255,255,255,0.85)',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                        }}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}

                    {/* Name + handle */}
                    <div style={{ minWidth: 0 }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
                            @{username}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>
                            {totalSubscribers.toLocaleString('en-IN')} subscribers
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div style={{
            height: 180, borderRadius: 16, overflow: 'hidden',
            background: 'linear-gradient(135deg,#1a1a2e,#0d0020)',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
        }}>
            <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />
                <div>
                    <div className="skeleton" style={{ height: 14, width: 90, marginBottom: 6, borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: 60, borderRadius: 4 }} />
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Explore() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [creators, setCreators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);

    // Derive state from URL search params (single source of truth)
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'All';
    const page = parseInt(searchParams.get('page') || '1', 10);

    const [searchInput, setSearchInput] = useState(search);

    const fetchCreators = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {
                page,
                limit: 12,
                sort: '-subscriberCount',
                ...(search ? { search } : {}),
                ...(category !== 'All' ? { category } : {}),
            };
            const { data } = await creatorService.list(params);
            setCreators(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotalResults(data.totalResults ?? 0);
        } catch {
            setError('Failed to load creators. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [page, search, category]);

    useEffect(() => { fetchCreators(); }, [fetchCreators]);

    // Keep search input in sync when URL changes (e.g., Navbar search)
    useEffect(() => { setSearchInput(searchParams.get('search') || ''); }, [searchParams]);

    const updateParams = (updates) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([k, v]) => {
            if (v) next.set(k, v); else next.delete(k);
        });
        next.set('page', '1'); // always reset to page 1 when filtering
        setSearchParams(next);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        updateParams({ search: searchInput.trim() });
    };

    const handleCategory = (cat) => updateParams({ category: cat === 'All' ? '' : cat });

    const goPage = (p) => {
        const next = new URLSearchParams(searchParams);
        next.set('page', p);
        setSearchParams(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

            {/* ── Hero header ────────────────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="text-4xl font-black text-white mb-1">
                    Explore <span className="gradient-text">Creators</span>
                </h1>
                <p className="text-surface-400">
                    {totalResults > 0 && !loading
                        ? `${totalResults.toLocaleString('en-IN')} creator${totalResults !== 1 ? 's' : ''} found`
                        : 'Discover exclusive content from the best creators.'}
                </p>
            </div>

            {/* ── Controls ──────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                        </svg>
                        <input type="search" value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by name or bio…"
                            className="input-dark pl-9 rounded-xl" />
                    </div>
                    <button type="submit" className="btn-brand px-5 py-2.5 rounded-xl">Search</button>
                </form>
            </div>

            {/* Category filters hidden for now */}
            {/*
            <div className="flex flex-wrap gap-2 mb-8">
                {CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => handleCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${category === cat || (cat === 'All' && !category)
                            ? 'btn-brand'
                            : 'glass text-surface-300 hover:text-white border border-white/10 hover:border-brand-500/40'
                            }`}>
                        {cat}
                    </button>
                ))}
            </div>
            */}

            {/* ── Error ──────────────────────────────────────────────────────────── */}
            {error && (
                <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}{' '}
                    <button onClick={fetchCreators} className="underline hover:text-red-300 ml-1">Retry</button>
                </div>
            )}

            {/* ── Grid ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {loading
                    ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                    : creators.length === 0
                        ? (
                            <div className="col-span-full text-center py-20">
                                <div className="text-5xl mb-4">😔</div>
                                <p className="text-surface-400 text-lg">No creators found.</p>
                                {search && (
                                    <button onClick={() => updateParams({ search: '' })}
                                        className="mt-4 btn-outline px-6 py-2">
                                        Clear search
                                    </button>
                                )}
                            </div>
                        )
                        : creators.map((c) => <CreatorCard key={c._id} creator={c} />)
                }
            </div>

            {/* ── Pagination ─────────────────────────────────────────────────────── */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                    <button disabled={page <= 1} onClick={() => goPage(page - 1)}
                        className="px-4 py-2 rounded-xl text-sm glass disabled:opacity-30 hover:bg-white/10 transition-all text-surface-300 hover:text-white">
                        ← Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                        const p = i + 1;
                        return (
                            <button key={p} onClick={() => goPage(p)}
                                className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${p === page ? 'btn-brand' : 'glass text-surface-300 hover:text-white hover:bg-white/10'
                                    }`}>
                                {p}
                            </button>
                        );
                    })}
                    <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}
                        className="px-4 py-2 rounded-xl text-sm glass disabled:opacity-30 hover:bg-white/10 transition-all text-surface-300 hover:text-white">
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
