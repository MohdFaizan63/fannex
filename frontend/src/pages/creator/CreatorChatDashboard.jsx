import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import chatService from '../../services/chatService';

export default function CreatorChatDashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [settings, setSettings] = useState({ chatEnabled: false, chatPrice: 199, minGift: 50, maxGift: 10000 });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [tab, setTab] = useState('inbox'); // 'inbox' | 'settings'
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
            console.error('Save error:', e);
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return (
            <div className="min-h-screen bg-[#080810] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080810] text-white pt-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="max-w-3xl mx-auto px-4">

                {/* ── Page header ───────────────────────────────────────────── */}
                <div className="mb-8">
                    <h1 className="text-2xl font-black mb-1">Chat Dashboard</h1>
                    <p className="text-white/40 text-sm">Manage conversations and earn from fans</p>
                </div>

                {/* ── Stats row ─────────────────────────────────────────────── */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                        {[
                            { label: 'Total Chats', value: stats.totalChats, icon: '💬' },
                            { label: 'Unread', value: stats.unreadMessages, icon: '🔔', highlight: stats.unreadMessages > 0 },
                            { label: 'Gift Earnings', value: `₹${stats.giftEarnings?.toLocaleString('en-IN')}`, icon: '🎁' },
                            { label: 'Chat Earnings', value: `₹${stats.totalChatEarnings?.toLocaleString('en-IN')}`, icon: '💰' },
                        ].map((s) => (
                            <div key={s.label} className={`rounded-2xl p-4 border ${s.highlight ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/8 bg-white/4'}`}>
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className="text-xl font-bold">{s.value}</div>
                                <div className="text-white/40 text-xs">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Tabs ──────────────────────────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 w-fit">
                    {['inbox', 'settings'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* ── Inbox ─────────────────────────────────────────────────── */}
                {tab === 'inbox' && (
                    <div className="space-y-2">
                        {rooms.length === 0 ? (
                            <div className="text-center py-20 text-white/30">
                                <div className="text-4xl mb-3">💬</div>
                                <p>No chats yet. Enable chat from Settings.</p>
                            </div>
                        ) : rooms.map(room => (
                            <motion.button
                                key={room._id}
                                whileHover={{ x: 4 }}
                                onClick={() => navigate(`/chat/${room._id}`)}
                                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-left"
                            >
                                <div className="w-11 h-11 rounded-full bg-violet-600/30 flex-shrink-0 flex items-center justify-center text-white font-bold">
                                    {room.userId?.name?.[0]?.toUpperCase() || 'F'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-semibold text-sm">{room.userId?.name || 'Fan'}</div>
                                    <div className="text-white/40 text-xs truncate">{room.lastMessage || 'No messages yet'}</div>
                                </div>
                                {room.unreadByCreator > 0 && (
                                    <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {room.unreadByCreator}
                                    </span>
                                )}
                            </motion.button>
                        ))}
                    </div>
                )}

                {/* ── Settings ──────────────────────────────────────────────── */}
                {tab === 'settings' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/4 border border-white/8 rounded-2xl p-6 space-y-5"
                    >
                        <h2 className="text-lg font-bold mb-4">Chat Pricing</h2>

                        {/* Enable toggle */}
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <div className="text-white font-medium text-sm">Enable Chat</div>
                                <div className="text-white/40 text-xs">Allow fans to chat with you for a fee</div>
                            </div>
                            <button
                                onClick={() => setSettings(s => ({ ...s, chatEnabled: !s.chatEnabled }))}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.chatEnabled ? 'bg-violet-600' : 'bg-white/15'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.chatEnabled ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {[
                            { key: 'chatPrice', label: 'Chat Price (₹)', placeholder: '199', help: 'Per conversation access fee' },
                            { key: 'minGift', label: 'Minimum Gift (₹)', placeholder: '50', help: 'Lowest gift fans can send' },
                            { key: 'maxGift', label: 'Maximum Gift (₹)', placeholder: '10000', help: 'Highest gift fans can send' },
                        ].map(field => (
                            <div key={field.key}>
                                <label className="block text-white/60 text-xs mb-1.5 font-medium">{field.label}</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={settings[field.key] || ''}
                                    onChange={(e) => setSettings(s => ({ ...s, [field.key]: Number(e.target.value) }))}
                                    placeholder={field.placeholder}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500/50 transition-colors placeholder:text-white/20"
                                />
                                <p className="text-white/30 text-xs mt-1">{field.help}</p>
                            </div>
                        ))}

                        {saveError && (
                            <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2 px-3">
                                ❌ {saveError}
                            </p>
                        )}
                        {saveSuccess && (
                            <p className="text-green-400 text-sm text-center bg-green-500/10 border border-green-500/20 rounded-xl py-2 px-3">
                                ✅ Settings saved!
                            </p>
                        )}

                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 font-semibold text-sm transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
