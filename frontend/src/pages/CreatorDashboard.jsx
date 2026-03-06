import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { creatorService } from '../services/creatorService';

// Analytics stat card
function StatCard({ icon, label, value, sub, gradient }) {
    return (
        <div className={`glass rounded-2xl p-5 border border-white/5 relative overflow-hidden`}>
            <div className={`absolute inset-0 opacity-5 rounded-2xl ${gradient}`} />
            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs text-surface-500 font-medium">{sub}</span>
                </div>
                <p className="text-2xl font-black text-white">{value ?? '—'}</p>
                <p className="text-sm text-surface-400 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

export default function CreatorDashboard() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [earnings, setEarnings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        creatorService.getEarnings()
            .then(({ data }) => setEarnings(data.data))
            .catch(e => setError(e?.response?.data?.message || 'Failed to load earnings'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-surface-950 pt-20 pb-12 px-4">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-white">Creator Dashboard</h1>
                        <p className="text-surface-400 text-sm mt-0.5">
                            Welcome back, <span className="text-brand-400">{user?.name}</span>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link to="/upload" className="btn-outline px-4 py-2 text-sm">
                            📤 Upload Post
                        </Link>
                        <Link to="/earnings" className="btn-brand px-4 py-2 text-sm">
                            💰 View Earnings
                        </Link>
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mb-6 glass border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Analytics grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon="👥" label="Total Subscribers"
                        value={earnings?.totalSubscribers ?? 0}
                        sub="All time" gradient="bg-brand-500"
                    />
                    <StatCard
                        icon="💰" label="Total Earned"
                        value={earnings ? `₹${earnings.totalEarned?.toFixed(0)}` : null}
                        sub="Lifetime" gradient="bg-violet-500"
                    />
                    <StatCard
                        icon="⏳" label="Pending Balance"
                        value={earnings ? `₹${earnings.pendingBalance?.toFixed(0)}` : null}
                        sub="Withdrawable" gradient="bg-amber-500"
                    />
                    <StatCard
                        icon="📝" label="Total Posts"
                        value={earnings?.totalPosts ?? 0}
                        sub="Published" gradient="bg-blue-500"
                    />
                </div>

                {/* Quick actions */}
                <div className="glass rounded-2xl border border-white/5 p-6 mb-8">
                    <h2 className="text-base font-bold text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { to: '/upload', icon: '📤', label: 'Upload New Post', desc: 'Share exclusive content' },
                            { to: '/earnings', icon: '💸', label: 'View Earnings', desc: 'Payouts & transaction history' },
                            { to: '/profile/edit', icon: '✏️', label: 'Edit Profile', desc: 'Update bio and settings' },
                        ].map(({ to, icon, label, desc }) => (
                            <Link key={to} to={to}
                                className="flex items-start gap-3 p-4 rounded-xl bg-surface-800/60 border border-surface-700 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all group">
                                <span className="text-2xl mt-0.5">{icon}</span>
                                <div>
                                    <p className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">{label}</p>
                                    <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Verification status banner if pending */}
                {user?.verificationStatus === 'pending' && (
                    <div className="glass border border-amber-500/30 rounded-2xl px-5 py-4 flex items-start gap-3">
                        <span className="text-2xl mt-0.5">⏳</span>
                        <div>
                            <p className="text-amber-400 font-semibold text-sm">Verification Pending</p>
                            <p className="text-surface-400 text-xs mt-0.5">
                                Your identity documents are under review. You'll unlock full creator privileges once approved (24–48 hrs).
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
