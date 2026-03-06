import { useNavigate } from 'react-router-dom';

/**
 * SubscribeGateModal — popup shown when a non-subscribed user tries to like or comment.
 *
 * Props:
 *  creatorName   – display name of the creator
 *  creatorUsername – url-friendly username for navigation
 *  onClose       – () => void
 */
export default function SubscribeGateModal({ creatorName, creatorUsername, onClose }) {
    const navigate = useNavigate();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="glass rounded-2xl border border-white/10 p-6 w-full max-w-sm shadow-2xl animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-brand-500/20 to-violet-600/20 border border-brand-500/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </div>

                {/* Text */}
                <h3 className="text-lg font-bold text-white text-center mb-1">
                    Subscribe to Interact
                </h3>
                <p className="text-surface-400 text-sm text-center mb-6 leading-relaxed">
                    Subscribe to <span className="text-brand-400 font-medium">{creatorName || 'this creator'}</span> to like posts and join the conversation.
                </p>

                {/* Actions */}
                <button
                    onClick={() => {
                        onClose();
                        if (creatorUsername) navigate(`/creator/${creatorUsername}`);
                    }}
                    className="btn-brand w-full py-3 text-sm mb-3"
                >
                    ✨ Subscribe Now
                </button>
                <button
                    onClick={onClose}
                    className="w-full py-2.5 text-sm text-surface-400 hover:text-white transition-colors font-medium"
                >
                    Maybe Later
                </button>
            </div>
        </div>
    );
}
