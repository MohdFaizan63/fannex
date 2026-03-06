import { Link } from 'react-router-dom';

export default function SubscriptionCancel() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
            style={{ backgroundColor: 'var(--color-surface-900)' }}>

            {/* Decorative orb */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #ef4444, transparent 65%)' }} />
            </div>

            <div className="relative z-10 max-w-md animate-fade-in-up">
                {/* Cancel icon */}
                <div className="w-24 h-24 rounded-full bg-surface-800 border-2 border-surface-600 flex items-center justify-center mx-auto mb-6">
                    <span className="text-5xl">😕</span>
                </div>

                <h1 className="text-3xl font-black text-white mb-3">Payment cancelled</h1>
                <p className="text-surface-400 mb-8 leading-relaxed">
                    No worries — you haven't been charged. You can subscribe again whenever you're ready.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/explore" className="btn-brand px-8 py-3">
                        Back to Explore
                    </Link>
                    <Link to="/" className="btn-outline px-8 py-3">
                        Go Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
