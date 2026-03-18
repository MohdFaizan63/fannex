import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import chatService from '../../services/chatService';
import '../../components/chat/chat.css';

export default function CreatorChatDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [settings, setSettings] = useState({ chatEnabled: false, chatPrice: 499, messagePrice: 10, minGift: 50, maxGift: 10000 });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [tab, setTab] = useState('inbox');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            chatService.getChatStats(),
            chatService.getCreatorRooms(),
            chatService.getChatSettings(),
        ]).then(([statsRes, roomsRes, settingsRes]) => {
            setStats(statsRes.data.data);
            setRooms(roomsRes.data.data);
            setSettings(settingsRes.data.data);
        }).catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        setSaveError('');
        setSaveSuccess(false);
        try {
            await chatService.updateChatSettings(settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Save failed. Try again.';
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="chat-loading">
                <div className="chat-spinner" />
                <span className="chat-loading-text">Loading dashboard…</span>
            </div>
        );
    }

    return (
        <div className="chat-dashboard">
            <div className="chat-dashboard-inner">

                {/* ── Page header ───────────────────────────────────────────── */}
                <div className="chat-dashboard-header" style={{ marginBottom: 24 }}>
                    <h1>Chat Dashboard</h1>
                    <p>Manage conversations and earn from fans</p>
                </div>


                {/* ── Tabs ──────────────────────────────────────────────────── */}
                <div className="chat-tabs">
                    {['inbox', 'settings'].map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`chat-tab ${tab === t ? 'chat-tab--active' : ''}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* ── Inbox ─────────────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                    {tab === 'inbox' && (
                        <motion.div
                            key="inbox"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {rooms.length === 0 ? (
                                <div className="chat-inbox-empty">
                                    <div className="chat-inbox-empty-icon">💬</div>
                                    <p className="chat-inbox-empty-text">No chats yet. Enable chat from Settings.</p>
                                </div>
                            ) : rooms.map((room, i) => (
                                <motion.button
                                    key={room._id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04, duration: 0.2 }}
                                    onClick={() => navigate(`/chat/${room._id}`)}
                                    className="chat-inbox-item"
                                >
                                    <div className="chat-inbox-avatar">
                                        {room.userId?.name?.[0]?.toUpperCase() || 'F'}
                                    </div>
                                    <div className="chat-inbox-info">
                                        <div className="chat-inbox-name">{room.userId?.name || 'Fan'}</div>
                                        <div className="chat-inbox-preview">{room.lastMessage || 'No messages yet'}</div>
                                    </div>
                                    {room.unreadByCreator > 0 && (
                                        <span className="chat-inbox-badge">
                                            {room.unreadByCreator}
                                        </span>
                                    )}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}

                    {/* ── Settings ──────────────────────────────────────────────── */}
                    {tab === 'settings' && (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="chat-settings-panel"
                        >
                            <h2>Chat Pricing</h2>

                            {/* Enable toggle */}
                            <div className="chat-toggle-row">
                                <div>
                                    <div className="chat-toggle-label">Enable Chat</div>
                                    <div className="chat-toggle-desc">Allow fans to chat with you for a fee</div>
                                </div>
                                <button
                                    onClick={() => setSettings(s => ({ ...s, chatEnabled: !s.chatEnabled }))}
                                    className={`chat-toggle-switch ${settings.chatEnabled ? 'chat-toggle-switch--on' : 'chat-toggle-switch--off'}`}
                                >
                                    <span className="chat-toggle-knob" />
                                </button>
                            </div>

                            {[
                                { key: 'messagePrice', label: 'Message Price (₹)', placeholder: '20', help: 'Deducted from fan wallet per message sent' },
                            ].map(field => (
                                <div key={field.key} style={{ marginTop: 16 }}>
                                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                                        {field.label}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={settings[field.key] || ''}
                                        onChange={(e) => setSettings(s => ({ ...s, [field.key]: Number(e.target.value) }))}
                                        placeholder={field.placeholder}
                                        className="chat-settings-input"
                                    />
                                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
                                        {field.help}
                                    </p>
                                </div>
                            ))}

                            {saveError && (
                                <div className="chat-alert chat-alert--error" style={{ marginTop: 12 }}>
                                    ❌ {saveError}
                                </div>
                            )}
                            {saveSuccess && (
                                <div className="chat-alert chat-alert--success" style={{ marginTop: 12 }}>
                                    ✅ Settings saved!
                                </div>
                            )}

                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="chat-settings-save"
                            >
                                {saving ? 'Saving…' : 'Save Settings'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
