import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Subscriptions() {
    const { user } = useAuth();
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/subscriptions/my')
            .then(({ data }) => setSubs(data.data || []))
            .catch(() => setSubs([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen px-4 pt-10 pb-16" style={{ backgroundColor: 'var(--color-surface-900)' }}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-white mb-1">My Subscriptions</h1>
                    <p className="text-surface-400 text-sm">Creators you're currently subscribed to</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    </div>
                ) : subs.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">💜</div>
                        <h2 className="text-xl font-bold text-white mb-2">No subscriptions yet</h2>
                        <p className="text-surface-400 text-sm mb-6">
                            Explore creators and subscribe to unlock exclusive content.
                        </p>
                        <Link to="/explore" className="btn-brand px-8 py-3">
                            Explore Creators
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subs.map((sub) => {
                            const creator = sub.creator;
                            if (!creator) return null;
                            const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
                            const isActive = sub.status === 'active';
                            return (
                                <Link
                                    key={sub._id}
                                    to={`/creator/${creator.username}`}
                                    className="block"
                                    style={{ textDecoration: 'none' }}
                                >
                                    {/* Fanvue-style card: full-bleed cover, overlaid info */}
                                    <div style={{
                                        position: 'relative',
                                        height: 180,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        background: 'linear-gradient(135deg,#2d0050,#0d0020)',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; }}
                                    >
                                        {/* Cover photo */}
                                        {creator.coverImage && (
                                            <img
                                                src={creator.coverImage}
                                                alt="cover"
                                                style={{
                                                    position: 'absolute', inset: 0,
                                                    width: '100%', height: '100%',
                                                    objectFit: 'cover',
                                                    objectPosition: `center ${creator.coverImagePosition ?? 50}%`,
                                                }}
                                            />
                                        )}

                                        {/* Dark gradient overlay at bottom */}
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.05) 100%)',
                                        }} />

                                        {/* Top-right: View pill button */}
                                        <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                            <span style={{
                                                background: 'rgba(255,255,255,0.15)',
                                                backdropFilter: 'blur(8px)',
                                                border: '1px solid rgba(255,255,255,0.25)',
                                                color: '#fff',
                                                fontSize: 12, fontWeight: 700,
                                                padding: '5px 13px', borderRadius: 999,
                                            }}>
                                                {isActive ? 'Active' : 'Expired'}
                                            </span>
                                        </div>

                                        {/* Bottom: avatar + name overlaid */}
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            padding: '12px 14px',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                        }}>
                                            {/* Avatar */}
                                            {creator.profileImage ? (
                                                <img
                                                    src={creator.profileImage}
                                                    alt={creator.displayName}
                                                    style={{
                                                        width: 44, height: 44, borderRadius: '50%',
                                                        objectFit: 'cover', flexShrink: 0,
                                                        border: '2.5px solid rgba(255,255,255,0.7)',
                                                        objectPosition: `center ${creator.profileImagePosition ?? 50}%`,
                                                    }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 700, fontSize: 16,
                                                    border: '2.5px solid rgba(255,255,255,0.7)',
                                                }}>
                                                    {creator.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            {/* Name + handle */}
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                                                    {creator.displayName}
                                                </p>
                                                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
                                                    @{creator.username}
                                                </p>
                                                {expiresAt && (
                                                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: 0 }}>
                                                        {isActive ? 'Renews' : 'Expired'} {expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
