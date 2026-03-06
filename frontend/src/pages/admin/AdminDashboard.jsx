import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { formatCurrency } from '../../utils/helpers';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, to, accent }) {
    const card = (
        <div className={`glass rounded-2xl p-5 border transition-all hover:-translate-y-0.5 ${accent ? 'border-brand-500/30 hover:border-brand-500/50' : 'border-white/5 hover:border-white/15'
            }`}>
            <span className="text-3xl block mb-3">{icon}</span>
            <p className={`text-2xl font-black mb-1 ${accent ? 'gradient-text' : 'text-white'}`}>
                {value}
            </p>
            <p className="text-xs uppercase tracking-widest text-surface-500 font-medium">{label}</p>
        </div>
    );
    return to ? <Link to={to}>{card}</Link> : card;
}

// ── Quick action row ──────────────────────────────────────────────────────────
const QUICK_LINKS = [
    { to: '/admin/users', label: '👥 Manage Users', desc: 'Ban, unban, delete accounts' },
    { to: '/admin/verifications', label: '🪪 Verifications', desc: 'Review pending KYC requests' },
    { to: '/admin/payouts', label: '💸 Payouts', desc: 'Approve & process payouts' },
];

// ── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        adminService.getAnalytics()
            .then(({ data }) => setStats(data.data ?? data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const cards = [
        {
            icon: '👥',
            label: 'Total Users',
            value: stats?.totalUsers?.toLocaleString('en-IN') ?? '—',
        },
        {
            icon: '🎨',
            label: 'Total Creators',
            value: stats?.totalCreators?.toLocaleString('en-IN') ?? '—',
            to: '/admin/users',
        },
        {
            icon: '⏳',
            label: 'Pending Verifications',
            value: stats?.pendingVerifications?.toLocaleString('en-IN') ?? '—',
            to: '/admin/verifications',
            accent: (stats?.pendingVerifications ?? 0) > 0,
        },
        {
            icon: '💸',
            label: 'Total Payouts',
            value: stats?.totalPayouts !== undefined ? formatCurrency(stats.totalPayouts) : '—',
            to: '/admin/payouts',
        },
    ];

    return (
        <div className="p-6 max-w-6xl">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
                <p className="text-surface-400 mt-1">Platform overview and management.</p>
            </div>

            {/* ── Stat cards ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {cards.map((c) =>
                    loading
                        ? (
                            <div key={c.label} className="glass rounded-2xl p-5 border border-white/5 animate-pulse">
                                <div className="skeleton w-8 h-8 rounded-lg mb-3" />
                                <div className="skeleton h-7 w-24 mb-2" />
                                <div className="skeleton h-3 w-16" />
                            </div>
                        )
                        : <StatCard key={c.label} {...c} />
                )}
            </div>

            {/* ── Quick navigation ─────────────────────────────────────────────────── */}
            <h2 className="text-lg font-bold text-white mb-4">Management</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {QUICK_LINKS.map(({ to, label, desc }) => (
                    <Link key={to} to={to}
                        className="glass rounded-2xl p-5 border border-white/5 hover:border-brand-500/40 transition-all group hover:-translate-y-0.5">
                        <p className="font-semibold text-white group-hover:text-brand-300 transition-colors">{label}</p>
                        <p className="text-xs text-surface-500 mt-1">{desc}</p>
                        <span className="text-brand-500 text-xs mt-3 block group-hover:translate-x-1 transition-transform">View →</span>
                    </Link>
                ))}
            </div>

            {/* ── Platform health indicators ───────────────────────────────────────── */}
            {!loading && stats && (
                <div className="glass rounded-2xl p-5 border border-white/5">
                    <h2 className="font-bold text-white mb-4">Platform Health</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        {[
                            { label: 'Total Subscriptions', value: stats.totalSubscriptions?.toLocaleString('en-IN') },
                            { label: 'Total Posts', value: stats.totalPosts?.toLocaleString('en-IN') },
                            { label: 'Pending Payouts', value: stats.pendingPayouts?.toLocaleString('en-IN') },
                            { label: 'Banned Users', value: stats.bannedUsers?.toLocaleString('en-IN') },
                        ].map(({ label, value }) => value !== undefined ? (
                            <div key={label}>
                                <p className="text-surface-500 text-xs uppercase tracking-widest">{label}</p>
                                <p className="text-white font-bold mt-1">{value ?? '—'}</p>
                            </div>
                        ) : null)}
                    </div>
                </div>
            )}
        </div>
    );
}
