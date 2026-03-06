import { useState, useCallback } from 'react';
import postService from '../services/postService';

/**
 * LikeButton — animated heart toggle with count.
 *
 * Props:
 *  postId       – post ObjectId
 *  initialLiked – boolean
 *  initialCount – number
 *  isSubscribed – boolean (is user subscribed to this creator)
 *  onGate       – () => void  (show subscribe gate modal)
 */
export default function LikeButton({ postId, initialLiked = false, initialCount = 0, isSubscribed, onGate }) {
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [animating, setAnimating] = useState(false);
    const [busy, setBusy] = useState(false);

    const handleClick = useCallback(async () => {
        if (!isSubscribed) {
            onGate?.();
            return;
        }
        if (busy) return;

        // Optimistic update
        const prevLiked = liked;
        const prevCount = count;
        setLiked(!liked);
        setCount(liked ? Math.max(0, count - 1) : count + 1);
        if (!liked) {
            setAnimating(true);
            setTimeout(() => setAnimating(false), 600);
        }

        setBusy(true);
        try {
            const { data } = await postService.toggleLike(postId);
            setLiked(data.liked);
            setCount(data.likesCount);
        } catch (err) {
            // Rollback
            setLiked(prevLiked);
            setCount(prevCount);

            // If subscription required, show gate
            if (err.response?.data?.requiresSubscription) {
                onGate?.();
            }
        } finally {
            setBusy(false);
        }
    }, [postId, liked, count, busy, isSubscribed, onGate]);

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-1.5 transition-all group"
            aria-label={liked ? 'Unlike' : 'Like'}
        >
            <svg
                className={`w-5 h-5 transition-all duration-300 ${liked
                        ? 'text-red-500 scale-110'
                        : 'text-surface-500 group-hover:text-red-400'
                    } ${animating ? 'like-btn-pop' : ''}`}
                viewBox="0 0 24 24"
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={liked ? 0 : 2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
            </svg>
            <span className={`text-sm font-medium transition-colors ${liked ? 'text-red-400' : 'text-surface-500 group-hover:text-surface-300'}`}>
                {count}
            </span>
        </button>
    );
}
