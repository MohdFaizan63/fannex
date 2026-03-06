import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import subscriptionService from '../services/subscriptionService';
import api from '../services/api';
import Input from '../components/Input';
import { Loader, EmptyState, ErrorMessage } from '../components/ui';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';

// ── Subscription row ──────────────────────────────────────────────────────────
function SubRow({ sub }) {
    const creator = sub.creatorId ?? {};
    const STATUS = {
        active: 'bg-green-500/20  text-green-400  border-green-500/30',
        cancelled: 'bg-surface-700  text-surface-500 border-surface-600',
        expired: 'bg-red-500/20   text-red-400    border-red-500/30',
    };
    return (
        <tr className="hover:bg-white/[0.02] transition-colors">
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {creator.name?.charAt(0)?.toUpperCase() ?? 'C'}
                    </div>
                    <p className="text-white text-sm font-medium truncate max-w-[140px]">{creator.name ?? '—'}</p>
                </div>
            </td>
            <td className="px-5 py-4 text-surface-300 text-sm">{formatDate(sub.createdAt)}</td>
            <td className="px-5 py-4 text-surface-300 text-sm">{sub.expiresAt ? formatDate(sub.expiresAt) : '—'}</td>
            <td className="px-5 py-4 text-white font-semibold text-sm">{sub.amount ? formatCurrency(sub.amount) : '—'}</td>
            <td className="px-5 py-4">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS[sub.status] ?? STATUS.expired}`}>
                    {sub.status ?? 'unknown'}
                </span>
            </td>
        </tr>
    );
}

// ── Avatar upload ─────────────────────────────────────────────────────────────
function AvatarUpload({ user, onUploaded }) {
    const [uploading, setUploading] = useState(false);
    const handleChange = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('avatar', f);
        try {
            await api.put('/auth/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            onUploaded();
        } catch { /* silent */ } finally { setUploading(false); }
    };

    return (
        <label className="relative group cursor-pointer select-none w-24 h-24">
            {/* Avatar */}
            {user?.profileImage ? (
                <img src={user.profileImage} alt={user.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-surface-700 ring-2 ring-brand-500/40 group-hover:opacity-80 transition-opacity" />
            ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-violet-600
          flex items-center justify-center text-white text-3xl font-bold border-2 border-surface-700 group-hover:opacity-80 transition-opacity">
                    {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
            )}
            {/* Edit overlay */}
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                {uploading
                    ? <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    : <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0" />
                    </svg>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </label>
    );
}

// ── Main UserProfile page ─────────────────────────────────────────────────────
export default function UserProfile() {
    const { user, refreshUser } = useAuth();

    const [subs, setSubs] = useState([]);
    const [loadingSubs, setLoadingSubs] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [serverError, setServerError] = useState('');

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: { name: user?.name ?? '', bio: user?.bio ?? '' },
    });

    // Reset form whenever user object updates
    useEffect(() => { reset({ name: user?.name ?? '', bio: user?.bio ?? '' }); }, [user, reset]);

    // Load subscription history
    useEffect(() => {
        subscriptionService.mySubscriptions({ limit: 50, sort: '-createdAt' })
            .then(({ data }) => setSubs(data.results ?? []))
            .catch(() => { })
            .finally(() => setLoadingSubs(false));
    }, []);

    const onSave = async (data) => {
        setServerError('');
        try {
            await api.put('/auth/me', { name: data.name.trim(), bio: data.bio?.trim() });
            await refreshUser();
            setSaveSuccess(true);
            setEditing(false);
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err) {
            setServerError(getErrorMessage(err));
        }
    };

    if (!user) return <Loader text="Loading profile…" />;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

            {/* ── Profile card ───────────────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-white/5 p-6 sm:p-8 mb-8">

                {/* Top row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
                    <AvatarUpload user={user} onUploaded={refreshUser} />
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-white">{user.name}</h1>
                        <p className="text-surface-400 mt-1 text-sm">{user.email}</p>
                        {user.bio && <p className="text-surface-300 text-sm mt-2 leading-relaxed">{user.bio}</p>}
                        <div className="flex flex-wrap gap-3 mt-3">
                            <span className={`text-xs px-3 py-1 rounded-full border font-medium capitalize ${user.role === 'admin' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                user.role === 'creator' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                    'bg-surface-700 text-surface-400 border-surface-600'
                                }`}>{user.role}</span>
                            {user.isVerified !== undefined && (
                                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${user.isVerified ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-surface-700 text-surface-500 border-surface-600'
                                    }`}>{user.isVerified ? '✓ Verified' : 'Unverified'}</span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => { setEditing((e) => !e); setServerError(''); }}
                        className={editing ? 'btn-outline text-sm px-5 py-2' : 'btn-brand text-sm px-5 py-2 self-start sm:self-center'}>
                        {editing ? 'Cancel' : '✏️ Edit Profile'}
                    </button>
                </div>

                {/* Success banner */}
                {saveSuccess && (
                    <div className="mb-4 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                        ✓ Profile updated successfully.
                    </div>
                )}

                {/* ── Edit form ────────────────────────────────────────────────────── */}
                {editing && (
                    <form onSubmit={handleSubmit(onSave)} className="border-t border-white/5 pt-6 flex flex-col gap-5 animate-fade-in-up">
                        {serverError && <ErrorMessage message={serverError} />}

                        <Input
                            label="Display Name"
                            placeholder="Your name"
                            error={errors.name?.message}
                            {...register('name', {
                                required: 'Name is required',
                                minLength: { value: 2, message: 'At least 2 characters' },
                                maxLength: { value: 80, message: 'Max 80 characters' },
                            })}
                        />

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1.5">Bio</label>
                            <textarea
                                rows={3}
                                placeholder="Tell your fans about yourself…"
                                className="input-dark w-full resize-none"
                                {...register('bio', { maxLength: { value: 500, message: 'Max 500 characters' } })}
                            />
                            {errors.bio && <p className="mt-1 text-xs text-red-400">{errors.bio.message}</p>}
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => { setEditing(false); reset(); }}
                                className="btn-outline px-6 py-2.5">Cancel</button>
                            <button type="submit" disabled={isSubmitting}
                                className="btn-brand px-6 py-2.5">
                                {isSubmitting
                                    ? <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving…
                                    </span>
                                    : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Account details ──────────────────────────────────────────────── */}
                {!editing && (
                    <div className="border-t border-white/5 pt-6 grid sm:grid-cols-2 gap-4">
                        {[
                            { label: 'Email', value: user.email },
                            { label: 'Joined', value: user.createdAt ? formatDate(user.createdAt) : '—' },
                            { label: 'Role', value: user.role },
                            { label: 'Email verified', value: user.emailVerified ? 'Yes' : 'No' },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-xs text-surface-500 uppercase tracking-widest font-medium">{label}</p>
                                <p className="text-sm text-white mt-1">{value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Subscription history ─────────────────────────────────────────────── */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-5 sm:px-8 py-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="font-bold text-white">Subscription History</h2>
                    <span className="text-xs text-surface-500">{subs.length} subscription{subs.length !== 1 ? 's' : ''}</span>
                </div>

                {loadingSubs ? (
                    <Loader size="sm" text="Loading subscriptions…" />
                ) : subs.length === 0 ? (
                    <EmptyState emoji="⭐" title="No subscriptions yet"
                        description="Explore creators and subscribe to unlock exclusive content."
                        actionLabel="Explore Creators" actionTo="/explore" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/5">
                                    {['Creator', 'Started', 'Expires', 'Amount', 'Status'].map((h) => (
                                        <th key={h} className="px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {subs.map((s) => <SubRow key={s._id} sub={s} />)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
