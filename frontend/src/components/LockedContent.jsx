import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import subscriptionService from '../services/subscriptionService';
import { useState } from 'react';

/**
 * LockedContent — wraps any media (image, video, custom children) and shows a
 * blurred overlay when the user is not subscribed to the creator.
 *
 * Props:
 *   isLocked     {boolean}  — whether this content requires a subscription
 *   isSubscribed {boolean}  — whether the current user is subscribed
 *   creatorId    {string}   — Mongo ID of the creator (needed for subscribe flow)
 *   creatorName  {string}   — display name for subscribe button label
 *   mediaUrl     {string}   — src for img or video
 *   mediaType    {"image"|"video"} — defaults to "image"
 *   alt          {string}   — alt text for image
 *   className    {string}   — extra classes on the wrapper
 *   onSubscribed {Function} — called after successful subscription
 *   children     {node}     — optional: if provided, renders children as media
 *                             instead of mediaUrl
 */
export default function LockedContent({
    isLocked = false,
    isSubscribed = false,
    creatorId,
    creatorName = 'this creator',
    mediaUrl,
    mediaType = 'image',
    alt = '',
    className = '',
    onSubscribed,
    children,
}) {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const locked = isLocked && !isSubscribed;

    const handleSubscribe = async () => {
        if (!isAuthenticated) { navigate('/login'); return; }
        setLoading(true);
        setError('');
        try {
            // Stripe checkout — backend returns { url }
            const { data } = await subscriptionService.createCheckoutSession(creatorId);
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch {
            setError('Could not start checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`relative overflow-hidden rounded-xl ${className}`}>
            {/* ── Media ──────────────────────────────────────────────────────────── */}
            <div className={`transition-all duration-500 ${locked ? 'blur-xl brightness-50 scale-105 pointer-events-none select-none' : ''}`}>
                {children ? children : (
                    mediaType === 'video' ? (
                        <video
                            src={locked ? undefined : mediaUrl}
                            className="w-full h-full object-cover"
                            controls={!locked}
                            muted
                            playsInline
                        />
                    ) : (
                        <img
                            src={mediaUrl}
                            alt={locked ? '' : alt}
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                    )
                )}
            </div>

            {/* ── Lock overlay ──────────────────────────────────────────────────── */}
            {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5">
                    {/* Glass card */}
                    <div className="glass rounded-2xl px-6 py-5 border border-white/10 max-w-xs w-full">
                        <div className="text-3xl mb-2">🔒</div>
                        <p className="text-white font-semibold text-sm mb-1">Subscriber-only content</p>
                        <p className="text-surface-400 text-xs mb-4">
                            Subscribe to {creatorName} to unlock this post.
                        </p>

                        {error && (
                            <p className="text-xs text-red-400 mb-3">{error}</p>
                        )}

                        <button
                            onClick={handleSubscribe}
                            disabled={loading}
                            className="btn-brand w-full py-2 text-sm"
                        >
                            {loading
                                ? <span className="flex items-center justify-center gap-2">
                                    <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                                    Loading…
                                </span>
                                : 'Subscribe to Unlock'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
