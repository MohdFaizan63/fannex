import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

/**
 * MainLayout — wraps all public and authenticated pages.
 * Navbar fixed at top (pt-16 offsets the content).
 * Footer is hidden for authenticated users.
 * Creator profile pages hide the navbar for a full-bleed cover experience.
 */
export default function MainLayout() {
    const { isAuthenticated } = useAuth();
    const { pathname } = useLocation();

    // Creator profile: /creator/:username — navbar hidden, no padding offset
    const isCreatorProfile = /^\/creator\/[^/]+$/.test(pathname);

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            {!isCreatorProfile && <Navbar />}
            <main className={`flex-1 ${isCreatorProfile ? '' : 'pt-16'}`}>
                <Outlet />
            </main>
            {!isAuthenticated && !isCreatorProfile && <Footer />}
        </div>
    );
}
