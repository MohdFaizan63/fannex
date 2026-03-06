import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

/**
 * MainLayout — wraps all public and authenticated pages.
 * Navbar fixed at top (pt-16 offsets the content).
 * Footer is hidden for authenticated users.
 */
export default function MainLayout() {
    const { isAuthenticated } = useAuth();
    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            <Navbar />
            <main className="flex-1 pt-16">
                <Outlet />
            </main>
            {!isAuthenticated && <Footer />}
        </div>
    );
}
