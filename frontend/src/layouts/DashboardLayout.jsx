import { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, ScrollRestoration } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Sidebar navigation items by role ──────────────────────────────────────────
const CREATOR_NAV = [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/insights', icon: '📈', label: 'Insights' },
    { to: '/upload', icon: '➕', label: 'New Post' },
    { to: '/earnings', icon: '💰', label: 'Earnings' },
    { to: '/creator/chat', icon: '💬', label: 'Chat' },
];


const ADMIN_NAV = [
    { to: '/admin', icon: '🛡️', label: 'Overview' },
    { to: '/admin/users', icon: '👥', label: 'Users' },
    { to: '/admin/creators', icon: '👩‍🎨', label: 'Creators' },
    { to: '/admin/verifications', icon: '🪪', label: 'Verifications' },
    { to: '/admin/payouts', icon: '💸', label: 'Payouts' },
    { to: '/admin/issues', icon: '🛟', label: 'Issues' },
];

export default function DashboardLayout() {
    const { user, isAdmin, isCreator, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false); // mobile sidebar

    const navItems = isAdmin ? ADMIN_NAV : CREATOR_NAV;

    const navClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
            ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
            : 'text-surface-300 hover:bg-white/5 hover:text-white'
        }`;

    const handleLogout = () => { logout(); navigate('/'); };

    return (
        <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            <ScrollRestoration />
            {/* ── Mobile overlay ──────────────────────────────────────────────────── */}
            {open && (
                <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />
            )}

            {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 glass border-r border-white/10
        transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Logo area — hidden on desktop (Navbar shows Fannex) */}
                <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 flex-shrink-0">
                    <Link to="/" className="text-xl font-black gradient-text lg:hidden">Fannex</Link>
                    <div className="hidden lg:block" /> {/* spacer on desktop */}
                    <button className="ml-auto lg:hidden p-1 text-surface-400 hover:text-white"
                        onClick={() => setOpen(false)} aria-label="Close sidebar">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* User card */}
                <div className="px-4 py-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {user?.profileImage ? (
                            <img src={user.profileImage} alt={user.name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-brand-500/30" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-600
              flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                            <p className="text-xs text-surface-400 truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-widest text-surface-600 px-4 mb-2 font-semibold">
                        {isAdmin ? 'Admin Panel' : 'Creator Studio'}
                    </p>
                    {navItems.map(({ to, icon, label }) => (
                        <NavLink key={to} to={to} className={navClass} onClick={() => setOpen(false)} end={to === '/admin'}>
                            <span className="text-base leading-none">{icon}</span>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom: explore + logout */}
                <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-1 flex-shrink-0">
                    <button onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all w-full text-left">
                        <span className="text-base">🚪</span> Sign out
                    </button>
                </div>
            </aside>

            {/* ── Main content area ────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col lg:ml-64 min-w-0 overflow-hidden">


                {/* Page content */}
                <main className="flex-1 overflow-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
