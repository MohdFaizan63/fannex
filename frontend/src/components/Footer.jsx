import { Link } from 'react-router-dom';

const FOOTER_LINKS = {
    Product: [{ label: 'Explore', to: '/explore' }, { label: 'For Creators', to: '/register' }, { label: 'Pricing', to: '/' }],
    Company: [{ label: 'About', to: '/' }, { label: 'Blog', to: '/' }, { label: 'Careers', to: '/' }],
    Legal: [{ label: 'Privacy', to: '/' }, { label: 'Terms', to: '/' }, { label: 'Cookie Policy', to: '/' }],
    Support: [{ label: 'Help Center', to: '/' }, { label: 'Contact', to: '/' }, { label: 'Creator Support', to: '/' }],
};

const SOCIALS = [
    { label: 'Twitter / X', href: '#', icon: 'X' },
    { label: 'Instagram', href: '#', icon: '📸' },
    { label: 'Discord', href: '#', icon: '💬' },
];

export default function Footer() {
    return (
        <footer className="border-t border-white/10" style={{ backgroundColor: 'var(--color-surface-800)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">

                {/* ── Brand + tagline ───────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12">
                    <div className="max-w-xs">
                        <Link to="/" className="text-2xl font-black gradient-text">Fannex</Link>
                        <p className="mt-3 text-sm text-surface-400 leading-relaxed">
                            The creator economy platform. Support your favourite creators, unlock exclusive content.
                        </p>
                        {/* Socials */}
                        <div className="flex items-center gap-3 mt-5">
                            {SOCIALS.map(({ label, href, icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-sm hover:border-brand-500/60 hover:text-brand-400 transition-all"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* ── Link columns ─────────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                        {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                            <div key={category}>
                                <h4 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-4">
                                    {category}
                                </h4>
                                <ul className="flex flex-col gap-2.5">
                                    {links.map(({ label, to }) => (
                                        <li key={label}>
                                            <Link to={to} className="text-sm text-surface-300 hover:text-white transition-colors">
                                                {label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Bottom bar ───────────────────────────────────────────────── */}
                <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-surface-500">
                        © {new Date().getFullYear()} Fannex. All rights reserved.
                    </p>
                    <p className="text-xs text-surface-600 flex items-center gap-1">
                        Built with <span className="text-brand-500">♥</span> for creators worldwide
                    </p>
                </div>
            </div>
        </footer>
    );
}
