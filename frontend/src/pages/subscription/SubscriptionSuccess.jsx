import { useEffect, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChatButton from '../../components/chat/ChatButton';

export default function SubscriptionSuccess() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { refreshUser } = useAuth();

    // Stripe sends ?session_id= after successful checkout
    const sessionId = searchParams.get('session_id');

    // Creator info may be passed via location.state from SubscribePage
    const creatorId = location.state?.creatorId;
    const creatorName = location.state?.creatorName || 'the creator';
    const creatorUsername = location.state?.creatorUsername;

    useEffect(() => {
        refreshUser().catch(() => { });
    }, [refreshUser]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
            style={{ backgroundColor: 'var(--color-surface-900)', fontFamily: "'Inter', sans-serif" }}>

            {/* Decorative orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #10b981, transparent 65%)' }} />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #7c3aed, transparent 65%)' }} />
            </div>

            <div className="relative z-10 max-w-md w-full">
                {/* Success icon */}
                <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                    <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-3xl font-black text-white mb-3">You're subscribed! 🎉</h1>
                <p className="text-surface-400 mb-6 leading-relaxed">
                    Your subscription is now active. Enjoy exclusive content from <strong className="text-white">{creatorName}</strong>!
                </p>

                {sessionId && (
                    <p className="text-xs text-surface-600 mb-6 font-mono">Reference: {sessionId}</p>
                )}

                {/* ── Premium Chat CTA ─────────────────────────────────────── */}
                {creatorId && (
                    <div className="mb-6 bg-white/4 border border-violet-500/20 rounded-3xl p-5 text-left">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">💬</span>
                            <span className="font-bold text-white text-sm">Want to go deeper?</span>
                        </div>
                        <p className="text-white/50 text-sm mb-4 leading-relaxed">
                            Start a private conversation with {creatorName}. Ask anything. Get personal replies.
                        </p>
                        <ChatButton
                            creatorId={creatorId}
                            creatorName={creatorName}
                            variant="banner"
                            className="w-full justify-center"
                        />
                    </div>
                )}

                {/* ── Actions ───────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {creatorUsername && (
                        <Link to={`/creator/${creatorUsername}`} className="btn-brand px-8 py-3">
                            View {creatorName}'s Profile
                        </Link>
                    )}
                    <Link to="/explore" className="btn-outline px-8 py-3">
                        Explore Creators
                    </Link>
                </div>
            </div>
        </div>
    );
}
