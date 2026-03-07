import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatorOnboardingModal from './onboarding/CreatorOnboardingModal';
import NotificationBell from './NotificationBell';

export default function Navbar() {
    const { user, isAuthenticated, isCreator, isAdmin, logout, creatorApplicationStatus } = useAuth();
    const navigate = useNavigate();

    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [onboardingOpen, setOnboardingOpen] = useState(false);

    const searchRef = useRef(null);
    const dropdownRef = useRef(null);

    // Glass blur on scroll
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = () => { logout(); navigate('/'); setDropdownOpen(false); };

    const handleSearch = (e) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (q) { navigate(`/explore?search=${encodeURIComponent(q)}`); setSearchQuery(''); setSearchOpen(false); }
    };

    const navLinkClass = ({ isActive }) =>
        `text-sm font-medium transition-colors ${isActive ? 'text-brand-400' : 'text-surface-300 hover:text-white'}`;

    return (
        <>
            <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'glass border-b border-white/5 shadow-lg' : 'bg-transparent'
                }`}>

                <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="flex items-center h-16 gap-4">

                        {/* ── Logo ─────────────────────────────────────────────────────── */}
                        <Link to="/" className="flex-shrink-0 select-none">
                            <span className="text-2xl font-black gradient-text tracking-tight">Fannex</span>
                        </Link>

                        {/* ── Desktop Nav links ─────────────────────────────────────────── */}
                        <nav className="hidden md:flex items-center gap-6 ml-4">
                            <NavLink to="/" className={navLinkClass} end>Home</NavLink>
                            <NavLink to="/explore" className={navLinkClass}>Explore</NavLink>
                            {isCreator && <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>}
                            {isAdmin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
                        </nav>

                        {/* ── Search bar (desktop) ──────────────────────────────────────── */}
                        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-sm mx-4">
                            <div className="relative w-full">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                                </svg>
                                <input
                                    ref={searchRef}
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search creators…"
                                    className="w-full pl-9 pr-4 py-2 rounded-full text-sm bg-surface-700/60 border border-surface-600 text-white placeholder-surface-500
                  focus:outline-none focus:border-brand-500 focus:bg-surface-700 focus:shadow-[0_0_0_3px_rgba(204,82,184,0.15)] transition-all"
                                />
                            </div>
                        </form>

                        {/* spacer on mobile */}
                        <div className="flex-1 md:hidden" />

                        {/* ── Desktop right side ─────────────────────────────────────────── */}
                        <div className="hidden md:flex items-center gap-2">
                            {isAuthenticated ? (
                                <>
                                    <NotificationBell />
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setDropdownOpen((o) => !o)}
                                            className="flex items-center gap-2 rounded-full px-3 py-1.5 glass hover:bg-white/10 transition-all"
                                        >
                                            <Avatar user={user} />
                                            <span className="text-sm text-white/80 font-medium max-w-[90px] truncate">{user?.name}</span>
                                            <ChevronIcon open={dropdownOpen} />
                                        </button>

                                        {dropdownOpen && (
                                            <div className="absolute right-0 mt-2 w-52 glass rounded-xl shadow-2xl border border-white/10 py-1 animate-fade-in-up">
                                                {/* Profile — always shown */}
                                                <DropdownLink to="/profile" onClick={() => setDropdownOpen(false)}>👤 My Profile</DropdownLink>
                                                <div className="border-t border-white/10 my-1" />
                                                {/* Become a Creator — only for normal users (not fan/creator/admin) */}
                                                {isAuthenticated && !isCreator && !isAdmin &&
                                                    user?.signupSource !== 'creator_profile' && !user?.creatorReferred && (
                                                        <>
                                                            <div className="border-t border-white/10 my-1" />
                                                            {creatorApplicationStatus === 'pending' ? (
                                                                <div className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 font-semibold cursor-not-allowed">
                                                                    <span className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                                                                    Verification Pending
                                                                </div>
                                                            ) : creatorApplicationStatus === 'rejected' ? (
                                                                <button
                                                                    onClick={() => { setOnboardingOpen(true); setDropdownOpen(false); }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 font-semibold transition-colors"
                                                                >
                                                                    ↩️ Reapply as Creator
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setOnboardingOpen(true); setDropdownOpen(false); }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-brand-400 hover:bg-brand-500/10 font-semibold transition-colors"
                                                                >
                                                                    🚀 Become a Creator
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                {/* Fan accounts see My Subscriptions in dropdown */}
                                                {isAuthenticated && !isCreator && !isAdmin && (
                                                    user?.signupSource === 'creator_profile' || !!user?.creatorReferred
                                                ) && (
                                                        <>
                                                            <div className="border-t border-white/10 my-1" />
                                                            <DropdownLink to="/subscriptions" onClick={() => setDropdownOpen(false)}>My Subscriptions</DropdownLink>
                                                        </>
                                                    )}
                                                {isCreator && <>
                                                    <DropdownLink to="/dashboard" onClick={() => setDropdownOpen(false)}>📊 Dashboard</DropdownLink>
                                                    <DropdownLink to="/upload" onClick={() => setDropdownOpen(false)}>➕ New Post</DropdownLink>
                                                    <DropdownLink to="/earnings" onClick={() => setDropdownOpen(false)}>💰 Earnings</DropdownLink>
                                                    <DropdownLink to="/creator/chat" onClick={() => setDropdownOpen(false)}>💬 Chat</DropdownLink>
                                                    <div className="border-t border-white/10 my-1" />
                                                </>}

                                                {isAdmin && <>
                                                    <DropdownLink to="/admin" onClick={() => setDropdownOpen(false)}>🛡️ Admin</DropdownLink>
                                                    <DropdownLink to="/admin/verifications" onClick={() => setDropdownOpen(false)}>🪪 Verifications</DropdownLink>
                                                    <DropdownLink to="/admin/payouts" onClick={() => setDropdownOpen(false)}>💸 Payouts</DropdownLink>
                                                    <div className="border-t border-white/10 my-1" />
                                                </>}
                                                <button onClick={handleLogout}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors">
                                                    🚪 Sign out
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="btn-outline text-sm px-5 py-2">Log in</Link>
                                    <Link to="/register" className="btn-brand  text-sm px-5 py-2">Sign up free</Link>
                                </>
                            )}
                        </div>

                        {/* ── Mobile: search icon + hamburger ──────────────────────────── */}
                        <div className="flex md:hidden items-center gap-1">
                            <button onClick={() => setSearchOpen((o) => !o)}
                                className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/10 transition-all" aria-label="Search">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                                </svg>
                            </button>
                            {isAuthenticated && <NotificationBell />}
                            <button onClick={() => setMobileOpen((o) => !o)}
                                className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/10 transition-all" aria-label="Menu">
                                {mobileOpen
                                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>}
                            </button>
                        </div>
                    </div>

                    {/* ── Mobile search bar ────────────────────────────────────────────── */}
                    {searchOpen && (
                        <form onSubmit={handleSearch} className="md:hidden pb-3 animate-fade-in-up">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                                </svg>
                                <input autoFocus type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search creators…"
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-surface-700 border border-surface-600 text-white placeholder-surface-500
                  focus:outline-none focus:border-brand-500 transition-all" />
                            </div>
                        </form>
                    )}

                    {/* ── Mobile menu ──────────────────────────────────────────────────── */}
                    {mobileOpen && (
                        <div className="md:hidden border-t border-white/10 py-4 flex flex-col gap-3 px-4 animate-fade-in-up bg-[rgba(18,18,18,0.97)] backdrop-blur-xl rounded-b-2xl shadow-2xl shadow-black/50">
                            <NavLink to="/" className={navLinkClass} end onClick={() => setMobileOpen(false)}>Home</NavLink>
                            <NavLink to="/explore" className={navLinkClass} onClick={() => setMobileOpen(false)}>Explore</NavLink>
                            {isCreator && <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</NavLink>}
                            {isAdmin && <NavLink to="/admin" className={navLinkClass} onClick={() => setMobileOpen(false)}>Admin</NavLink>}
                            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                                {isAuthenticated && !isCreator && !isAdmin && (
                                    <button
                                        onClick={() => { setOnboardingOpen(true); setMobileOpen(false); }}
                                        className="btn-brand text-sm font-semibold py-2"
                                    >
                                        🚀 Become a Creator
                                    </button>
                                )}
                                {isAuthenticated
                                    ? <button onClick={handleLogout} className="btn-outline w-full text-red-400 border-red-500/40">Sign out</button>
                                    : <>
                                        <Link to="/login" className="btn-outline w-full text-center" onClick={() => setMobileOpen(false)}>Log in</Link>
                                        <Link to="/register" className="btn-brand  w-full text-center" onClick={() => setMobileOpen(false)}>Sign up free</Link>
                                    </>
                                }
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* ── Creator Onboarding Modal ───────────────────────────────────── */}
            <CreatorOnboardingModal
                isOpen={onboardingOpen}
                onClose={() => setOnboardingOpen(false)}
            />
        </>
    );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Avatar({ user }) {
    return user?.profileImage ? (
        <img src={user.profileImage} alt={user.name}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-2 ring-brand-500/30" />
    ) : (
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </span>
    );
}

function ChevronIcon({ open }) {
    return (
        <svg className={`w-4 h-4 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function DropdownLink({ to, children, onClick }) {
    return (
        <Link to={to} onClick={onClick}
            className="block px-4 py-2 text-sm text-surface-200 hover:bg-white/5 hover:text-white transition-colors">
            {children}
        </Link>
    );
}
