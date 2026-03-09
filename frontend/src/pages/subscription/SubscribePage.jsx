import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import subscriptionService from '../../services/subscriptionService';

export default function SubscribePage() {
    const { username } = useParams();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [creator, setCreator] = useState(null);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const [error, setError] = useState('');
    const [alreadySubscribed, setAlreadySubscribed] = useState(false);

    // Redirect to signup if not authenticated — only after auth has loaded
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate(
                `/register?redirect=${encodeURIComponent(`/creator/${username}/subscribe`)}`,
                { replace: true }
            );
        }
    }, [isAuthenticated, authLoading, navigate, username]);

    // Load creator profile
    useEffect(() => {
        if (!username) return;
        setLoading(true);
        api.get(`/creator/profile/${username}`)
            .then(({ data }) => {
                setCreator(data.data);
                // Check subscription status
                if (isAuthenticated && data.data) {
                    const creatorId = data.data.userId || data.data._id;
                    subscriptionService.checkStatus(creatorId)
                        .then(({ data: statusData }) => {
                            if (statusData.data?.subscribed) {
                                setAlreadySubscribed(true);
                            }
                        })
                        .catch(() => { });
                }
            })
            .catch(() => setError('Creator not found'))
            .finally(() => setLoading(false));
    }, [username, isAuthenticated]);

    const handleConfirmSubscribe = async () => {
        if (!creator || subscribing) return;
        setSubscribing(true);
        setError('');

        try {
            const creatorId = creator.userId || creator._id;
            const response = await subscriptionService.createOrder(creatorId);
            const orderData = response.data?.data; // { orderId, paymentSessionId, amount, currency }

            if (!orderData?.paymentSessionId) {
                throw new Error('Invalid order response from server');
            }

            // Load Cashfree.js SDK dynamically
            if (!window.Cashfree) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const cashfree = window.Cashfree({ mode: 'sandbox' });
            cashfree.checkout({
                paymentSessionId: orderData.paymentSessionId,
                redirectTarget: '_self', // redirect in same tab
            });
            // After redirect back, SubscriptionSuccess page will call /api/payment/verify
        } catch (err) {
            console.error('Payment initiation error:', err);
            setError(err?.response?.data?.message || err.message || 'Unable to initiate payment. Please try again.');
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-900)' }}>
                <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (error && !creator) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-surface-900)' }}>
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link to="/explore" className="btn-brand px-6 py-2">Browse Creators</Link>
                </div>
            </div>
        );
    }

    if (!creator) return null;

    const price = creator.subscriptionPrice || 199;

    return (
        <div className="min-h-screen pt-16 pb-16 px-4" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            {/* Decorative orb */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #cc52b8, transparent 65%)' }} />
            </div>

            <div className="relative z-10 max-w-md mx-auto mt-8 animate-fade-in-up">
                {/* Creator card */}
                <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl">

                    {/* Banner */}
                    <div className="h-32 relative overflow-hidden bg-gradient-to-br from-brand-600/40 via-violet-600/30 to-surface-800">
                        {creator.coverImage && (
                            <img src={creator.coverImage} alt="cover"
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{ objectPosition: `center ${creator.coverImagePosition ?? 50}%` }} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    {/* Profile info */}
                    <div className="px-6 pb-6 -mt-10 relative">
                        <div className="flex items-end gap-4 mb-4">
                            {creator.profileImage ? (
                                <img src={creator.profileImage} alt={creator.displayName}
                                    className="w-20 h-20 rounded-full object-cover border-4 border-surface-900 shadow-xl"
                                    style={{ objectPosition: `center ${creator.profileImagePosition ?? 50}%` }} />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-surface-900 shadow-xl">
                                    {creator.displayName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="pb-1">
                                <h1 className="text-xl font-black text-white">{creator.displayName}</h1>
                                <p className="text-surface-400 text-sm">@{creator.username}</p>
                            </div>
                        </div>

                        {alreadySubscribed ? (
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-green-400 font-semibold mb-2">Already Subscribed!</p>
                                <p className="text-surface-400 text-sm mb-4">You have full access to this creator's content.</p>
                                <Link to={`/creator/${username}`} className="btn-brand w-full py-3 block text-center">
                                    View Content →
                                </Link>
                            </div>
                        ) : (
                            <>
                                {/* Price */}
                                <div className="text-center mb-6">
                                    <p className="text-surface-400 text-sm mb-1">Subscribe for</p>
                                    <p className="text-4xl font-black text-white">₹{price}<span className="text-lg text-surface-400 font-normal">/month</span></p>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-3 mb-6">
                                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">What you get</p>
                                    {[
                                        { icon: '🔓', text: 'Unlock all exclusive posts' },
                                        { icon: '🎬', text: 'Access private videos & photos' },
                                        { icon: '💜', text: 'Support the creator directly' },
                                        { icon: '⚡', text: 'Early access to new content' },
                                    ].map((b, i) => (
                                        <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/5">
                                            <span className="text-lg">{b.icon}</span>
                                            <span className="text-surface-300 text-sm">{b.text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                                        {error}
                                    </div>
                                )}

                                {/* CTA */}
                                <button
                                    onClick={handleConfirmSubscribe}
                                    disabled={subscribing}
                                    className="btn-brand w-full py-3.5 text-base font-bold disabled:opacity-60 flex items-center justify-center gap-2 rounded-xl"
                                >
                                    {subscribing ? (
                                        <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                                    ) : (
                                        `Confirm & Pay ₹${price}/mo`
                                    )}
                                </button>

                                <p className="text-center text-xs text-surface-600 mt-3">
                                    Secure payment via Cashfree. Cancel anytime.
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Back link */}
                <div className="text-center mt-6">
                    <Link to={`/creator/${username}`} className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
                        ← Back to {creator.displayName}'s profile
                    </Link>
                </div>
            </div>
        </div>
    );
}
