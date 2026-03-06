import { Link } from 'react-router-dom';

export default function SuccessStep({ onClose }) {
    return (
        <div className="flex flex-col items-center gap-6 text-center py-4 animate-fade-in-up">
            {/* Animated checkmark */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-violet-600
        flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(204,82,184,0.4)]
        animate-pulse">
                🎉
            </div>

            <div>
                <h2 className="text-2xl font-black text-white">Application Submitted!</h2>
                <p className="text-surface-400 mt-2 text-sm max-w-sm">
                    Your creator application has been received. Our team will review your documents within 24–48 hours.
                </p>
            </div>

            {/* Status timeline */}
            <div className="w-full glass rounded-xl border border-white/5 overflow-hidden">
                {[
                    { icon: '✅', label: 'Application Submitted', done: true },
                    { icon: '🔍', label: 'Documents Under Review', done: false },
                    { icon: '🪪', label: 'Identity Verified', done: false },
                    { icon: '🚀', label: 'Creator Dashboard Unlocked', done: false },
                ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0 ${item.done ? 'bg-green-500/5' : ''
                        }`}>
                        <span className="text-xl w-7 text-center">{item.icon}</span>
                        <span className={`text-sm font-medium ${item.done ? 'text-green-400' : 'text-surface-400'}`}>
                            {item.label}
                        </span>
                        {item.done && <span className="ml-auto text-xs text-green-500 font-semibold">Done</span>}
                        {!item.done && <span className="ml-auto text-xs text-surface-600">Pending</span>}
                    </div>
                ))}
            </div>

            <p className="text-xs text-surface-500">
                You'll receive an email notification once your account is approved.
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={onClose} className="btn-outline px-6 py-2.5 text-sm">
                    Back to Home
                </button>
                <Link to="/verification" onClick={onClose} className="btn-brand px-6 py-2.5 text-sm">
                    View Status →
                </Link>
            </div>
        </div>
    );
}
