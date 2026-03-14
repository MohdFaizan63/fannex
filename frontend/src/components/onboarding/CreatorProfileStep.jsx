import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

const inputBase = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: '14px',
    padding: '14px 16px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    WebkitAppearance: 'none',
    fontFamily: 'inherit',
};

function Field({ label, required, error, hint, children }) {
    return (
        <div>
            <label style={{
                display: 'block', fontSize: '11px', fontWeight: 700,
                color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '8px',
            }}>
                {label}{required && <span style={{ color: '#a855f7', marginLeft: '3px' }}>*</span>}
            </label>
            {children}
            {error
                ? <p style={{ marginTop: '6px', fontSize: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>⚠ {error}</p>
                : hint && <p style={{ marginTop: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{hint}</p>
            }
        </div>
    );
}

function SmartInput({ hasError, style: extra = {}, ...props }) {
    const [focused, setFocused] = useState(false);
    return (
        <input
            style={{
                ...inputBase,
                ...(focused ? { borderColor: 'rgba(168,85,247,0.6)', boxShadow: '0 0 0 3px rgba(124,58,237,0.15)' } : {}),
                ...(hasError ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 0 3px rgba(239,68,68,0.1)' } : {}),
                ...extra,
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
        />
    );
}

function SmartTextarea({ hasError, ...props }) {
    const [focused, setFocused] = useState(false);
    return (
        <textarea
            style={{
                ...inputBase,
                resize: 'none',
                lineHeight: 1.6,
                ...(focused ? { borderColor: 'rgba(168,85,247,0.6)', boxShadow: '0 0 0 3px rgba(124,58,237,0.15)' } : {}),
                ...(hasError ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 0 3px rgba(239,68,68,0.1)' } : {}),
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
        />
    );
}

export default function CreatorProfileStep({ register, errors, watch, setValue, setError, clearErrors }) {
    const username = watch('username');
    const bio = watch('bio') || '';
    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState(null);
    const usernameRef = useRef(null);
    const bioRef = useRef(null);

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

    const { ref: dRef, ...dRest } = register('displayName', {
        required: 'Display name is required',
        minLength: { value: 2, message: 'At least 2 characters' },
        maxLength: { value: 60, message: 'Max 60 characters' },
    });

    const { ref: uRef, ...uRest } = register('username', {
        required: 'Username is required',
        minLength: { value: 3, message: 'At least 3 characters' },
        maxLength: { value: 30, message: 'Max 30 characters' },
        pattern: {
            value: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: 'Must start with a letter, then letters/numbers/underscores',
        },
    });

    const { ref: bRef, ...bRest } = register('bio', {
        maxLength: { value: 300, message: 'Max 300 characters' },
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '8px' }}>
            {/* Step header */}
            <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                <div style={{
                    width: '50px', height: '50px', borderRadius: '15px', margin: '0 auto 10px',
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(204,82,184,0.25))',
                    border: '1px solid rgba(168,85,247,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                }}>👤</div>
                <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    Set Up Your Profile
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '5px', fontSize: '13px' }}>
                    How fans will discover you on Fannex
                </p>
            </div>

            {/* Display Name */}
            <Field label="Display Name" required error={errors.displayName?.message}>
                <SmartInput
                    autoFocus
                    autoComplete="name"
                    autoCapitalize="words"
                    inputMode="text"
                    enterKeyHint="next"
                    placeholder="e.g. Artsy Maya"
                    hasError={!!errors.displayName}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usernameRef.current?.focus(); } }}
                    ref={(el) => { dRef(el); }}
                    {...dRest}
                />
            </Field>

            {/* Username */}
            <Field
                label="Username"
                required
                error={errors.username?.message}
                hint={!errors.username && availability === 'available'
                    ? `✓ @${username} is available ✓`
                    : 'Letters, numbers & underscores only'}
            >
                <div style={{ position: 'relative' }}>
                    <span style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'rgba(168,85,247,0.8)', fontWeight: 700, fontSize: '15px',
                        pointerEvents: 'none', userSelect: 'none', zIndex: 1,
                    }}>@</span>
                    <SmartInput
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                        enterKeyHint="next"
                        placeholder="yourhandle"
                        hasError={!!errors.username}
                        style={{ paddingLeft: '30px', paddingRight: '40px' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bioRef.current?.focus(); } }}
                        ref={(el) => { uRef(el); usernameRef.current = el; }}
                        {...uRest}
                    />
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', lineHeight: 1 }}>
                        {checking && (
                            <span style={{
                                display: 'inline-block', width: '14px', height: '14px',
                                border: '2px solid rgba(168,85,247,0.3)', borderTopColor: '#a855f7',
                                borderRadius: '50%', animation: 'spinU 0.7s linear infinite',
                            }} />
                        )}
                        {!checking && availability === 'available' && <span style={{ color: '#4ade80' }}>✓</span>}
                        {!checking && availability === 'taken' && <span style={{ color: '#f87171' }}>✗</span>}
                    </span>
                </div>
            </Field>

            {/* Bio */}
            <Field label="Bio" hint={`${bio.length} / 300`} error={errors.bio?.message}>
                <SmartTextarea
                    rows={3}
                    placeholder="Tell your fans what kind of content you create…"
                    inputMode="text"
                    enterKeyHint="done"
                    autoCapitalize="sentences"
                    hasError={!!errors.bio}
                    ref={(el) => { bRef(el); bioRef.current = el; }}
                    {...bRest}
                />
            </Field>

            <style>{`@keyframes spinU { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
