import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// ─── Nav link data ────────────────────────────────────────────────────────────
const FOOTER_LINKS = {
    Platform: [
        { label: 'Explore Creators', to: '/explore' },
        { label: 'Become a Creator', to: '/register' },
    ],
    Company: [
        { label: 'About Us', to: '/about' },
        { label: 'Contact', to: '/contact' },
        { label: 'Creator Support', href: 'mailto:support@fannex.in?subject=Creator Support' },
    ],
    Legal: [
        { label: 'Privacy Policy', to: '/privacy' },
        { label: 'Terms of Service', to: '/terms' },
        { label: 'Cookie Policy', to: '/cookie-policy' },
    ],
};

// ─── SVG social icons ─────────────────────────────────────────────────────────
const IconX = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.26 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
);

const IconInstagram = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
);

const IconYoutube = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

const SOCIALS = [
    { label: 'X (Twitter)', href: '#', Icon: IconX },
    { label: 'Instagram', href: '#', Icon: IconInstagram },
    { label: 'YouTube', href: '#', Icon: IconYoutube },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Footer() {
    return (
        <footer
            className="relative overflow-hidden"
            style={{
                background: 'linear-gradient(180deg, #0a0015 0%, #030208 100%)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            {/* Glowing top edge */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5) 50%, transparent)' }}
            />
            {/* Ambient purple glow */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 100%, rgba(124,58,237,0.07) 0%, transparent 70%)' }}
            />

            <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-10">

                {/* ── Top section ─────────────────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-14">

                    {/* Brand block */}
                    <div className="max-w-72 flex-shrink-0">
                        <Link to="/" className="inline-block mb-4">
                            <span
                                className="text-2xl font-black tracking-tight"
                                style={{
                                    background: 'linear-gradient(135deg, #e879f9 0%, #a855f7 50%, #ec4899 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Fannex
                            </span>
                        </Link>
                        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 300 }}>
                            Turn your passion into income. Start your journey today — it's free.
                        </p>

                        {/* Socials */}
                        <div className="flex items-center gap-3 mt-7">
                            {SOCIALS.map(({ label, href, Icon }) => (
                                <motion.a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors duration-300"
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.45)',
                                    }}
                                    whileHover={{ scale: 1.12 }}
                                    transition={{ duration: 0.2 }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)';
                                        e.currentTarget.style.color = '#c084fc';
                                        e.currentTarget.style.background = 'rgba(168,85,247,0.1)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    }}
                                >
                                    <Icon />
                                </motion.a>
                            ))}
                        </div>

                        {/* Email chip */}
                        <a
                            href="mailto:support@fannex.in"
                            className="inline-flex items-center gap-2 mt-6 text-xs transition-colors duration-200"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#c084fc'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            support@fannex.in
                        </a>
                    </div>

                    {/* ── Link columns ──────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 lg:gap-16">
                        {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                            <div key={category}>
                                <h4
                                    className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5"
                                    style={{ color: 'rgba(255,255,255,0.25)' }}
                                >
                                    {category}
                                </h4>
                                <ul className="flex flex-col gap-3">
                                    {links.map(({ label, to, href }) => (
                                        <li key={label}>
                                            {href ? (
                                                <a
                                                    href={href}
                                                    className="text-sm transition-colors duration-200"
                                                    style={{ color: 'rgba(255,255,255,0.45)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                                                >
                                                    {label}
                                                </a>
                                            ) : (
                                                <Link
                                                    to={to}
                                                    className="text-sm transition-colors duration-200"
                                                    style={{ color: 'rgba(255,255,255,0.45)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                                                >
                                                    {label}
                                                </Link>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Bottom bar ────────────────────────────────────────────────── */}
                <div
                    className="mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        © {new Date().getFullYear()} Fannex. All rights reserved.
                    </p>
                    <div className="flex items-center gap-5">
                        <Link to="/privacy" className="text-xs transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >Privacy</Link>
                        <Link to="/terms" className="text-xs transition-colors duration-200" style={{ color: 'rgba(255,255,255,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                        >Terms</Link>
                        <p className="text-xs flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
                            Built with{' '}
                            <span style={{ color: '#a855f7', fontSize: '0.8rem' }}>♥</span>
                            {' '}for creators everywhere
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
