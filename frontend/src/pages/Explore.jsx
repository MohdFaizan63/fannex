import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { creatorService } from '../services/creatorService';
import { truncate } from '../utils/helpers';

const CATEGORIES = ['All', 'Art', 'Music', 'Gaming', 'Fitness', 'Beauty', 'Education', 'Tech', 'Travel', 'Food'];

// ── Creator card ──────────────────────────────────────────────────────────────
function CreatorCard({ creator }) {
    const {
        _id,
        displayName = 'Unknown',
        bio = '',
        profileImage,
        coverImage,
        totalSubscribers = 0,
        username,
        subscriptionPrice = 0,
    } = creator;

    return (
        <Link
            to={`/creator/${username || _id}`}
            className="group glass rounded-2xl overflow-hidden hover:border-brand-500/40 border border-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(204,82,184,0.15)]"
        >
            {/* Cover / banner area */}
            <div className="h-24 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #3a0060 0%, #0d0020 100%)' }}>
                {coverImage ? (
                    <img src={coverImage} alt="cover" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 opacity-30"
                        style={{ background: `radial-gradient(circle at 30% 50%, #cc52b8, transparent 60%)` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Avatar — overlaps cover */}
            <div className="px-4 -mt-8 pb-4">
                <div className="relative w-16 h-16 mb-3">
                    {profileImage ? (
                        <img src={profileImage} alt={displayName} loading="lazy"
                            className="w-16 h-16 rounded-full object-cover border-2 border-surface-800 ring-2 ring-brand-500/40" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-violet-600
              flex items-center justify-center text-white text-2xl font-bold border-2 border-surface-800">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <h3 className="font-bold text-white group-hover:text-brand-300 transition-colors truncate">{displayName}</h3>

                {bio && (
                    <p className="text-xs text-surface-400 mt-1 leading-relaxed line-clamp-2">
                        {truncate(bio, 100)}
                    </p>
                )}

                <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-surface-500">
                        <span className="text-white font-semibold">{totalSubscribers.toLocaleString('en-IN')}</span> subscribers
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 font-medium
            group-hover:bg-brand-500 group-hover:text-white transition-all">
                        {subscriptionPrice > 0 ? `₹${subscriptionPrice}/mo` : 'Free'}
                    </span>
                </div>
            </div>
        </Link>
    );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="glass rounded-2xl overflow-hidden border border-white/5">
            <div className="skeleton h-24" />
            <div className="px-4 -mt-8 pb-4">
                <div className="skeleton w-16 h-16 rounded-full mb-3 ring-2 ring-brand-500/10" />
                <div className="skeleton h-4 w-32 mb-2" />
                <div className="skeleton h-3 w-full mb-1" />
                <div className="skeleton h-3 w-2/3" />
                <div className="flex justify-between mt-4">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-6 w-20 rounded-full" />
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

            {/* ── Category filter pills ──────────────────────────────────────────── */}
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
