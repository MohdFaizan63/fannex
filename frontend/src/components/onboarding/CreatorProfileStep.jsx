import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function CreatorProfileStep({ register, errors, watch, setValue, setError, clearErrors }) {
    const username = watch('username');
    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState(null); // null | 'available' | 'taken'

    // Debounced username check
    useEffect(() => {
        if (!username || username.length < 3) { setAvailability(null); return; }
        const t = setTimeout(async () => {
            setChecking(true);
            try {
                const { data } = await api.get(`/creator/check-username?username=${username}`);
                if (data.available) { setAvailability('available'); clearErrors('username'); }
                else { setAvailability('taken'); setError('username', { message: 'Username is already taken' }); }
            } catch {
                setAvailability(null);
            } finally { setChecking(false); }
        }, 600);
        return () => clearTimeout(t);
    }, [username, setError, clearErrors]);

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
                <span className="text-5xl">👤</span>
                <h2 className="text-2xl font-black text-white mt-3">Set Up Your Creator Profile</h2>
                <p className="text-surface-400 mt-2 text-sm">
                    This is how fans will discover and recognise you on Fannex.
                </p>
            </div>

            {/* Display Name */}
            <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Display Name <span className="text-brand-500">*</span>
                </label>
                <input
                    className="input-dark"
                    placeholder="e.g. Artsy Maya"
                    {...register('displayName', {
                        required: 'Display name is required',
                        minLength: { value: 2, message: 'At least 2 characters' },
                        maxLength: { value: 60, message: 'Max 60 characters' },
                    })}
                />
                {errors.displayName && <p className="mt-1 text-xs text-red-400">{errors.displayName.message}</p>}
            </div>

            {/* Username */}
            <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Username / Handle <span className="text-brand-500">*</span>
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 font-medium text-sm select-none">@</span>
                    <input
                        className="input-dark pl-8 pr-10"
                        placeholder="yourhandle"
                        {...register('username', {
                            required: 'Username is required',
                            minLength: { value: 3, message: 'At least 3 characters' },
                            maxLength: { value: 30, message: 'Max 30 characters' },
                            pattern: {
                                value: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                                message: 'Must start with a letter, letters/numbers/underscores only',
                            },
                        })}
                    />
                    {/* Status icon */}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                        {checking && <span className="w-4 h-4 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin inline-block" />}
                        {!checking && availability === 'available' && <span className="text-green-400">✓</span>}
                        {!checking && availability === 'taken' && <span className="text-red-400">✗</span>}
                    </span>
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>}
                {!errors.username && availability === 'available' && (
                    <p className="mt-1 text-xs text-green-400">✓ @{username} is available</p>
                )}
            </div>

            {/* Bio */}
            <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Bio (optional)</label>
                <textarea
                    rows={3}
                    className="input-dark resize-none"
                    placeholder="Tell your fans what kind of content you create…"
                    {...register('bio', { maxLength: { value: 300, message: 'Max 300 characters' } })}
                />
                {errors.bio && <p className="mt-1 text-xs text-red-400">{errors.bio.message}</p>}
            </div>
        </div>
    );
}
