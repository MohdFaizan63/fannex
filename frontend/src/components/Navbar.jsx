import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatorOnboardingModal from './onboarding/CreatorOnboardingModal';
import NotificationBell from './NotificationBell';

export default function Navbar() {
    const { user, isAuthenticated, isCreator, isAdmin, logout, creatorApplicationStatus } = useAuth();
    const navigate = useNavigate();

    const [scrolled, setScrolled] = useState(false);
    const [headerVis, setHeaderVis] = useState(true); // auto-hide
    const [mobileOpen, setMobileOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [onboardingOpen, setOnboardingOpen] = useState(false);

    const searchRef = useRef(null);
    const searchContainerRef = useRef(null);
    const dropdownRef = useRef(null);
    const mobileRef = useRef(null);
    const lastScrollY = useRef(0);

    // ── Auto-hide header on scroll direction ─────────────────────────────────
    useEffect(() => {
        const onScroll = () => {
            const current = window.scrollY;
            setScrolled(current > 50);

            // Auto-hide only for guests (authenticated nav stays fixed/stable)
            if (!isAuthenticated) {
                if (current < 60 || mobileOpen) {
                    setHeaderVis(true);
                } else if (current > lastScrollY.current + 12) {
                    setHeaderVis(false);
                } else if (current < lastScrollY.current - 12) {
                    setHeaderVis(true);
                }
            }
            lastScrollY.current = current;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [mobileOpen, isAuthenticated]);

    // ── Close desktop dropdown on outside click ───────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Close mobile search on outside click ──────────────────────────────────
    useEffect(() => {
        if (!searchOpen) return;
        const handler = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setSearchOpen(false);
            }
        };
        // small delay so the button's own toggle click isn't caught immediately
        const t = setTimeout(() => {
            document.addEventListener('mousedown', handler);
            document.addEventListener('touchstart', handler);
        }, 50);
        return () => {
            clearTimeout(t);
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [searchOpen]);

    // ── Close mobile menu on outside click / overlay tap ────────────────────
    const closeMobile = useCallback(() => setMobileOpen(false), []);

    // Lock body scroll while mobile menu open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    const handleLogout = () => { logout(); navigate('/'); setDropdownOpen(false); };

    const handleSearch = (e) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (q) { navigate(`/explore?search=${encodeURIComponent(q)}`); setSearchQuery(''); setSearchOpen(false); }
    };

    const navLinkClass = ({ isActive }) =>
        `text-sm font-medium transition-colors ${isActive ? 'text-brand-400' : 'text-surface-300 hover:text-white'}`;

    const mobileLinkClass = ({ isActive }) =>
        `block py-3.5 px-1 text-base font-semibold border-b border-white/5 transition-colors ${isActive ? 'text-brand-400' : 'text-white/90 hover:text-white'}`;

    return (
        <>
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <header
                style={{
                    transform: headerVis ? 'translateY(0)' : 'translateY(-100%)',
                    transition: 'transform 0.3s cubic-bezier(0.25,0.4,0.25,1), background 0.3s ease, backdrop-filter 0.3s ease, box-shadow 0.3s ease',
                    willChange: 'transform',
                    background: isAuthenticated
                        ? (scrolled ? 'rgba(5, 2, 12, 0.8)' : 'transparent')
                        : (scrolled ? 'rgba(5, 2, 12, 0.8)' : 'transparent'),
                    backdropFilter: scrolled ? 'blur(20px)' : 'none',
                    WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
                    borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                    boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
                }}
                className="fixed top-0 inset-x-0 z-50"
            >
                <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <div className="flex items-center h-16 gap-4">

                        {/* ── Logo ─────────────────────────────────────────────── */}
                        <Link to="/" className="flex-shrink-0 select-none">
                            <span className="text-2xl font-black gradient-text tracking-tight">Fannex</span>
                        </Link>

                        {/* ── Desktop Nav links ──────────────────────────────────── */}
                        <nav className="hidden md:flex items-center gap-6 ml-4">
                            <NavLink to="/" className={navLinkClass} end>Home</NavLink>
                            <NavLink to="/explore" className={navLinkClass}>Explore</NavLink>
                            {isCreator && <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>}
                            {isAdmin && <NavLink to="/admin" className={navLinkClass}>Admin</NavLink>}
                        </nav>

                        {/* ── Search bar (desktop) ───────────────────────────────── */}
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

                        {/* ── Desktop right side ─────────────────────────────────── */}
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
                                                <DropdownLink to="/profile" onClick={() => setDropdownOpen(false)}>👤 My Profile</DropdownLink>
                                                <div className="border-t border-white/10 my-1" />
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
                                                                    Become a Creator
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
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

                        {/* ── Mobile: search + notification + hamburger ─────────── */}
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

                    {/* ── Mobile search bar ──────────────────────────────────────── */}
                    {searchOpen && (
                        <>
                            {/* Transparent overlay — tap anywhere to close search */}
                            <div
                                className="fixed inset-0 z-40 md:hidden"
                                onClick={() => setSearchOpen(false)}
                                aria-hidden="true"
                            />
                            <form ref={searchContainerRef} onSubmit={handleSearch} className="md:hidden pb-3 animate-fade-in-up relative z-50">
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
                        </>
                    )}
                </div>
            </header>

            {/* ── Mobile menu overlay + panel (outside header so it covers full screen) ── */}
            {mobileOpen && (
                <>
                    {/* Dark blur overlay — tap to close */}
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                        onClick={closeMobile}
                        aria-hidden="true"
                    />

                    {/* Premium slide-down panel */}
                    <div
                        ref={mobileRef}
                        className="fixed top-16 left-4 right-4 z-50 md:hidden rounded-[18px] px-5 py-5 flex flex-col gap-1"
                        style={{
                            background: '#121212',
                            boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
                            animation: 'mobileMenuIn 0.25s ease forwards',
                        }}
                    >
                        {/* Nav links */}
                        <NavLink to="/" className={mobileLinkClass} end onClick={closeMobile}>Home</NavLink>
                        <NavLink to="/explore" className={mobileLinkClass} onClick={closeMobile}>Explore</NavLink>
                        {isCreator && <NavLink to="/dashboard" className={mobileLinkClass} onClick={closeMobile}>Dashboard</NavLink>}
                        {isAdmin && <NavLink to="/admin" className={mobileLinkClass} onClick={closeMobile}>🛡️ Admin</NavLink>}

                        {/* Divider */}
                        <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

                        {/* Auth section */}
                        <div className="flex flex-col gap-3 mt-1">
                            {isAuthenticated ? (
                                <>
                                    {!isCreator && !isAdmin && (
                                        <button
                                            onClick={() => { setOnboardingOpen(true); closeMobile(); }}
                                            className="w-full h-12 rounded-xl font-semibold text-sm text-white"
                                            style={{ background: 'linear-gradient(90deg,#ff3bd4,#7b5cff)' }}
                                        >
                                            Become a Creator
                                        </button>
                                    )}
                                    <button onClick={() => { handleLogout(); closeMobile(); }}
                                        className="w-full h-12 rounded-xl font-semibold text-sm text-red-400"
                                        style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'transparent' }}>
                                        Sign out
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Login — outlined */}
                                    <Link to="/login" onClick={closeMobile}
                                        className="flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold text-white transition-all hover:bg-white/5"
                                        style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'transparent' }}>
                                        Log in
                                    </Link>
                                    {/* Sign up — gradient */}
                                    <Link to="/register" onClick={closeMobile}
                                        className="flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(90deg,#ff3bd4,#7b5cff)' }}>
                                        Sign up free
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Slide-in keyframe */}
            <style>{`
                @keyframes mobileMenuIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ── Creator Onboarding Modal ──────────────────────────────────────── */}
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
