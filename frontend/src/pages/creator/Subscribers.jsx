import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { creatorService } from '../../services/creatorService';
import { formatDate } from '../../utils/helpers';

const LIMIT = 20;

export default function Subscribers() {
    const [subs, setSubs] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const load = useCallback(async (p) => {
        setLoading(true);
        try {
            const { data } = await creatorService.mySubscribers({ page: p, limit: LIMIT, sort: '-createdAt' });
            setSubs(data.results ?? []);
            setTotalPages(data.totalPages ?? 1);
            setTotal(data.total ?? 0);
        } catch (_) { }
        setLoading(false);
    }, []);

    useEffect(() => { load(page); }, [page, load]);

    return (
        <div className="p-4 sm:p-6 w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-white">Subscribers</h1>
                    <p className="text-surface-400 text-sm mt-0.5">
                        {loading ? '…' : `${total} active subscriber${total !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <Link to="/dashboard" className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                    ← Dashboard
                </Link>
            </div>

            {/* List */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0">
                            <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
                            <div className="flex-1"><div className="skeleton h-4 w-28 mb-1" /><div className="skeleton h-3 w-20" /></div>
                        </div>
                    ))
                ) : subs.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-4xl mb-3">👥</div>
                        <p className="text-surface-500 text-sm">No subscribers yet.</p>
                    </div>
                ) : (
                    subs.map((s) => {
                        const user = s.subscriberId;
                        const name = user?.name ?? 'Unknown';
                        const initial = name.charAt(0).toUpperCase();
                        const avatar = user?.profileImage;

                        return (
                            <div key={s._id} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                                {/* Avatar */}
                                {avatar ? (
                                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {initial}
                                    </div>
                                )}

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{name}</p>
                                    <p className="text-xs text-surface-500 mt-0.5">
                                        Joined {formatDate(s.createdAt)}
                                        {s.expiresAt && <span> · Expires {formatDate(s.expiresAt)}</span>}
                                    </p>
                                </div>

                                {/* Status */}
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${s.status === 'active'
                                        ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                                        : 'bg-surface-700/50 text-surface-400 border border-white/5'
                                    }`}>
                                    {s.status === 'active' ? 'Active' : s.status}
                                </span>
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
        </div>
    );
}
