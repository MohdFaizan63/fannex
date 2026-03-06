import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCreatorStatus } from '../services/creatorService';

const STATUS_CONFIG = {
    pending: {
        icon: '⏳',
        color: 'amber',
        title: 'Verification Under Review',
        badge: 'Pending',
        message: 'Your documents are under review. This usually takes 24–48 hours. You\'ll receive an email notification once a decision is made.',
    },
    approved: {
        icon: '✅',
        color: 'green',
        title: 'Application Approved!',
        badge: 'Approved',
        message: 'Congratulations! Your creator application has been approved. Your profile is now live on the platform.',
    },
    rejected: {
        icon: '❌',
        color: 'red',
        title: 'Application Rejected',
        badge: 'Rejected',
        message: 'Unfortunately your application was not approved at this time. You can reapply with updated documents.',
    },
    none: {
        icon: '📝',
        color: 'surface',
        title: 'No Application Found',
        badge: 'None',
        message: 'You haven\'t submitted a creator application yet.',
    },
};

function StatusTimeline({ status }) {
    const STEPS = [
        { key: 'submitted', label: 'Application Submitted', icon: '📝' },
        { key: 'review', label: 'Documents Under Review', icon: '🔍' },
        { key: 'verified', label: 'Identity Verified', icon: '🪪' },
        { key: 'unlocked', label: 'Creator Dashboard Unlocked', icon: '🚀' },
    ];
    const activeIdx = status === 'none' ? -1 : status === 'pending' ? 1 : status === 'approved' ? 3 : 0;

    return (
        <div className="glass rounded-xl border border-white/5 overflow-hidden">
            {STEPS.map(({ key, label, icon }, i) => {
                const done = i <= activeIdx;
                const current = i === activeIdx;
                return (
                    <div key={key} className={`flex items-center gap-3 px-5 py-3.5 border-b border-white/5 last:border-0 transition-colors ${done ? 'bg-green-500/5' : ''}`}>
                        <span className="text-xl w-7 text-center">{icon}</span>
                        <span className={`text-sm font-medium flex-1 ${done ? 'text-green-400' : 'text-surface-500'}`}>{label}</span>
                        {done && <span className="text-xs font-semibold text-green-500 shrink-0">Done</span>}
                        {!done && current && <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative rounded-full h-2.5 w-2.5 bg-amber-400" />
                        </span>}
                        {!done && !current && <span className="text-xs text-surface-700 shrink-0">Pending</span>}
                    </div>
                );
            })}
        </div>
    );
}

export default function VerificationStatus() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const status = user?.creatorApplicationStatus ?? 'none';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;

    useEffect(() => {
        // Refresh user from backend for latest status
        refreshUser().catch(() => { });

        getCreatorStatus()
            .then(({ data }) => setProfile(data.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const colorMap = {
        amber: { border: 'border-amber-500/30', icon: 'bg-amber-500/10 text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        green: { border: 'border-green-500/30', icon: 'bg-green-500/10 text-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
        red: { border: 'border-red-500/30', icon: 'bg-red-500/10 text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
        surface: { border: 'border-surface-700', icon: 'bg-surface-800 text-surface-400', badge: 'bg-surface-800 text-surface-400 border-surface-700' },
    };
    const c = colorMap[cfg.color];

    return (
        <div className="min-h-screen bg-surface-950 pt-24 pb-12 px-4">
            <div className="max-w-xl mx-auto">

                {/* Back */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-surface-400 hover:text-white text-sm mb-6 transition-colors">
                    ← Back
                </button>

                {/* Header card */}
                <div className={`glass rounded-2xl border ${c.border} p-8 text-center mb-6`}>
                    <div className={`w-16 h-16 rounded-full ${c.icon} flex items-center justify-center text-3xl mx-auto mb-4`}>
                        {cfg.icon}
                    </div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${c.badge} mb-3`}>
                        {cfg.badge}
                    </span>
                    <h1 className="text-2xl font-black text-white mb-2">{cfg.title}</h1>
                    <p className="text-surface-400 text-sm leading-relaxed">{cfg.message}</p>

                    {/* Rejection reason */}
                    {status === 'rejected' && user?.creatorRejectionReason && (
                        <div className="mt-4 glass border border-red-500/20 rounded-xl px-4 py-3 text-left">
                            <p className="text-xs font-semibold text-red-400 mb-1">Rejection Reason:</p>
                            <p className="text-sm text-surface-300">{user.creatorRejectionReason}</p>
                        </div>
                    )}
                </div>

                {/* Application details */}
                {profile && (
                    <div className="glass rounded-2xl border border-white/5 p-5 mb-6">
                        <h2 className="text-sm font-bold text-white mb-3">Application Details</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-surface-500">Display Name</span>
                                <span className="text-surface-200">{profile.displayName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-surface-500">Username</span>
                                <span className="text-brand-400">@{profile.username}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-surface-500">Submitted</span>
                                <span className="text-surface-200">{new Date(profile.createdAt).toLocaleDateString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="mb-6">
                    <h2 className="text-sm font-bold text-white mb-3">Verification Progress</h2>
                    <StatusTimeline status={status} />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                    {status === 'approved' && (
                        <Link to="/dashboard" className="btn-brand w-full text-center py-3 text-sm font-semibold">
                            🚀 Go to Creator Dashboard
                        </Link>
                    )}
                    {status === 'rejected' && (
                        <Link to="/" className="btn-brand w-full text-center py-3 text-sm font-semibold">
                            🔁 Reapply as Creator
                        </Link>
                    )}
                    {status === 'pending' && (
                        <div className="glass border border-white/5 rounded-xl px-4 py-3 text-xs text-surface-500 leading-relaxed text-center">
                            🔔 You'll receive an email at <span className="text-white">{user?.email}</span> once your application is reviewed.
                        </div>
                    )}
                    <Link to="/" className="text-center text-sm text-surface-500 hover:text-surface-300 transition-colors">
                        ← Return to Home
                    </Link>
                </div>

            </div>
        </div>
    );
}
