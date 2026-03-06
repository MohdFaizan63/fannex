import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Subscriptions() {
    const { user } = useAuth();
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/subscriptions/my')
            .then(({ data }) => setSubs(data.data || []))
            .catch(() => setSubs([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen px-4 pt-10 pb-16" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-white mb-1">My Subscriptions</h1>
                    <p className="text-surface-400 text-sm">Creators you're currently subscribed to</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    </div>
                ) : subs.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">💜</div>
                        <h2 className="text-xl font-bold text-white mb-2">No subscriptions yet</h2>
                        <p className="text-surface-400 text-sm mb-6">
                            Explore creators and subscribe to unlock exclusive content.
                        </p>
                        <Link to="/explore" className="btn-brand px-8 py-3">
                            Explore Creators
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {subs.map((sub) => {
                            const creator = sub.creator;
                            if (!creator) return null;
                            const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
                            const isActive = sub.status === 'active';
                            return (
                                <div
                                    key={sub._id}
                                    className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl hover:shadow-brand-500/10 transition-all hover:-translate-y-0.5"
                                >
                                    {/* Banner */}
                                    <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-600/40 via-violet-600/30 to-surface-800">
                                        {creator.coverImage && (
                                            <img
                                                src={creator.coverImage}
                                                alt="cover"
                                                className="absolute inset-0 w-full h-full object-cover"
                                                style={{ objectPosition: `center ${creator.coverImagePosition ?? 50}%` }}
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    </div>

                                    {/* Profile info */}
                                    <div className="px-4 pb-4 -mt-8 relative">
                                        <div className="flex items-end gap-3 mb-3">
                                            {creator.profileImage ? (
                                                <img
                                                    src={creator.profileImage}
                                                    alt={creator.displayName}
                                                    className="w-14 h-14 rounded-full object-cover border-4 border-surface-900 shadow-lg flex-shrink-0"
                                                    style={{ objectPosition: `center ${creator.profileImagePosition ?? 50}%` }}
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold border-4 border-surface-900 shadow-lg flex-shrink-0">
                                                    {creator.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            <div className="pb-1 min-w-0">
                                                <p className="font-bold text-white text-sm truncate">{creator.displayName}</p>
                                                <p className="text-surface-400 text-xs">@{creator.username}</p>
                                            </div>
                                        </div>

                                        {/* Status badge */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
                                                {isActive ? 'Active' : 'Expired'}
                                            </span>
                                            {expiresAt && (
                                                <span className="text-xs text-surface-500">
                                                    {isActive ? 'Renews' : 'Expired'} {expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}
                                        </div>

                                        <Link
                                            to={`/creator/${creator.username}`}
                                            className="btn-brand w-full py-2 text-sm block text-center rounded-xl"
                                        >
                                            View Creator →
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
