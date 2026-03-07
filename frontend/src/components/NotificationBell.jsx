import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON = {
    new_post: '📸',
    comment_reply: '💬',
    subscription_expiring: '⏳',
    new_message: '✉️',
};

// ── Time-ago helper ───────────────────────────────────────────────────────────
function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);
    const navigate = useNavigate();

    // ── Fetch unread count on mount (and every 30s) ──────────────────────────
    const fetchCount = useCallback(async () => {
        try {
            const data = await notificationService.getUnreadCount();
            setUnreadCount(data.count ?? 0);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchCount();
        const iv = setInterval(fetchCount, 30_000);
        return () => clearInterval(iv);
    }, [fetchCount]);

    // ── Fetch notifications when panel opens ─────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await notificationService.getAll({ limit: 15 });
            setNotifications(data.results ?? []);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, fetchNotifications]);

    // ── Close on outside click ───────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleMarkAllRead = async () => {
        try {
            await notificationService.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch { /* silent */ }
    };

    const handleClick = async (notif) => {
        // Mark read
        if (!notif.isRead) {
            notificationService.markAsRead(notif._id).catch(() => { });
            setNotifications((prev) =>
                prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        }
        setOpen(false);

        // Navigate based on type
        if (notif.referenceModel === 'Post') {
            // Navigate to creator profile — we can't know the username so go back to explore
            navigate('/explore');
        } else if (notif.referenceModel === 'ChatRoom') {
            navigate('/creator/chat');
        } else if (notif.referenceModel === 'Subscription') {
            navigate('/my-subscriptions');
        }
    };

    return (
        <div className="relative" ref={ref}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-xl text-surface-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Notifications"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold shadow-lg shadow-brand-500/30">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-96 max-h-[400px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 flex flex-col sm:right-0 fixed sm:absolute right-4 sm:right-0 top-14 sm:top-auto"
                    style={{ background: '#121212', animation: 'fadeInDown 0.15s ease-out' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead}
                                className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium">
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="px-4 py-8 text-center text-surface-500 text-sm">Loading…</div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <div className="text-3xl mb-2">🔔</div>
                                <p className="text-surface-500 text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n._id}
                                    onClick={() => handleClick(n)}
                                    className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${!n.isRead ? 'bg-brand-500/5' : ''}`}
                                >
                                    <span className="text-lg mt-0.5 shrink-0">{ICON[n.type] || '🔔'}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${!n.isRead ? 'text-white font-medium' : 'text-surface-300'}`}>
                                            {n.title}
                                        </p>
                                        {n.body && (
                                            <p className="text-xs text-surface-500 mt-0.5 truncate">{n.body}</p>
                                        )}
                                        <p className="text-[10px] text-surface-600 mt-1">{timeAgo(n.createdAt)}</p>
                                    </div>
                                    {!n.isRead && (
                                        <span className="w-2 h-2 rounded-full bg-brand-500 mt-2 shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Fade-in animation */}
            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
