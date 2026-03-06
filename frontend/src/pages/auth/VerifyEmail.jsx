import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

/**
 * VerifyEmail — legacy redirect.
 * The old link-based verification has been replaced with OTP.
 * This page redirects users who may have old links bookmarked.
 */
export default function VerifyEmail() {
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => navigate('/login', { replace: true }), 3000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification updated</h2>
            <p className="text-surface-400 mb-6">
                We now use OTP codes instead of email links.<br />
                Redirecting you to login…
            </p>
            <Link to="/login" className="btn-brand px-8 py-3">Go to Login</Link>
        </div>
    );
}
