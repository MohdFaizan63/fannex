import { Outlet, Link } from 'react-router-dom';

/**
 * AuthLayout — minimal centered card for login/register/forgot-password pages.
 * No Navbar or Footer, just the brand logo + centered form card.
 */
export default function AuthLayout() {
    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
            style={{ backgroundColor: 'var(--color-surface-900)' }}
        >
            {/* Decorative background orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #cc52b8, transparent 70%)' }} />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
            </div>

            {/* Logo */}
            <Link to="/" className="mb-8 text-3xl font-black gradient-text select-none">
                Fannex
            </Link>

            {/* Card */}
            <div className="relative w-full max-w-md glass rounded-2xl p-8 shadow-2xl animate-fade-in-up">
                <Outlet />
            </div>

            <p className="mt-8 text-xs text-surface-600">
                © {new Date().getFullYear()} Fannex. All rights reserved.
            </p>
        </div>
    );
}
