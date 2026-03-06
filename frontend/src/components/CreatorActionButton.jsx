import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatorOnboardingModal from './onboarding/CreatorOnboardingModal';

/**
 * CreatorActionButton
 * Fan accounts (signupSource === 'creator_profile') see subscription CTAs.
 * Regular users see "Become a Creator".
 */
export default function CreatorActionButton({ size = 'md', className = '' }) {
    const { user, isAuthenticated, isCreator, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const status = user?.creatorApplicationStatus ?? 'none';
    const szCls = size === 'sm' ? 'text-sm px-4 py-2' : 'text-base px-7 py-3';
    // Fan account: either stored in DB or persisted in localStorage (handles existing accounts + post-logout)
    const isFanAccount = user?.signupSource === 'creator_profile'
        || user?.creatorReferred
        || localStorage.getItem('fannex_fan_intent') === 'true';

    const handleOnboardingSuccess = async () => {
        await refreshUser();
        setModalOpen(false);
        navigate('/creator/verification-status');
    };

    // Not logged in → sign up
    if (!isAuthenticated) {
        return (
            <Link to="/register" className={`btn-brand ${szCls} ${className}`}>
                🚀 Become a Creator
            </Link>
        );
    }

    // Already a creator → dashboard
    if (isCreator) {
        return (
            <Link to="/dashboard" className={`btn-brand ${szCls} ${className}`}>
                📊 Creator Dashboard
            </Link>
        );
    }

    // Fan account — always show My Subscriptions link
    if (isFanAccount) {
        return (
            <Link to="/subscriptions" className={`btn-brand ${szCls} ${className}`}>
                My Subscriptions
            </Link>
        );
    }

    // Pending verification
    if (status === 'pending') {
        return (
            <Link to="/creator/verification-status"
                className={`inline-flex items-center gap-2 rounded-full font-semibold transition-all bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 ${szCls} ${className}`}>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Verification Pending
            </Link>
        );
    }

    // Rejected → reapply
    if (status === 'rejected') {
        return (
            <>
                <button onClick={() => setModalOpen(true)}
                    className={`btn-outline border-red-500/50 text-red-400 hover:bg-red-500/10 ${szCls} ${className}`}>
                    🔁 Reapply as Creator
                </button>
                <CreatorOnboardingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleOnboardingSuccess} />
            </>
        );
    }

    // Default → Become a Creator
    return (
        <>
            <button onClick={() => setModalOpen(true)} className={`btn-brand ${szCls} ${className}`}>
                🚀 Become a Creator
            </button>
            <CreatorOnboardingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleOnboardingSuccess} />
        </>
    );
}
