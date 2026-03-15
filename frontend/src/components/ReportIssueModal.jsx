import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

// ── Constants ──────────────────────────────────────────────────────────────────
const ISSUE_TYPES = [
    { value: 'bug',                  label: '🐛 Bug' },
    { value: 'payment_issue',        label: '💳 Payment Issue' },
    { value: 'subscription_issue',   label: '🔒 Subscription Issue' },
    { value: 'chat_issue',           label: '💬 Chat Issue' },
    { value: 'content_issue',        label: '📸 Content Issue' },
    { value: 'feature_request',      label: '✨ Feature Request' },
    { value: 'other',                label: '❓ Other' },
];

const PRIORITIES = [
    { value: 'low',    label: '🟢 Low',    desc: 'Minor inconvenience' },
    { value: 'medium', label: '🟡 Medium', desc: 'Affecting functionality' },
    { value: 'high',   label: '🔴 High',   desc: 'Critical / blocking' },
];

const INITIAL = {
    issueType: '',
    title: '',
    description: '',
    priority: 'medium',
};

// ── Helper: collect device/browser info ───────────────────────────────────────
function getDeviceInfo() {
    try {
        const ua = navigator.userAgent;
        const platform = navigator.platform || 'Unknown';
        const screen = `${window.screen.width}×${window.screen.height}`;
        return `${ua} | Platform: ${platform} | Screen: ${screen}`;
    } catch {
        return 'Unknown device';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportIssueModal({ isOpen, onClose }) {
    const [form, setForm]           = useState(INITIAL);
    const [screenshot, setScreenshot] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess]     = useState(false);
    const [error, setError]         = useState('');
    const fileRef = useRef(null);
    const overlayRef = useRef(null);

    // Reset state whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setForm(INITIAL);
            setScreenshot(null);
            setScreenshotPreview('');
            setSuccess(false);
            setError('');
            setSubmitting(false);
        }
    }, [isOpen]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Only JPG, PNG, or WebP images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Screenshot must be under 5 MB.');
            return;
        }
        setScreenshot(file);
        setScreenshotPreview(URL.createObjectURL(file));
        setError('');
    };

    const handleRemoveScreenshot = () => {
        setScreenshot(null);
        setScreenshotPreview('');
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.issueType) return setError('Please select an issue type.');
        if (!form.title.trim()) return setError('Please add a short title.');
        if (!form.description.trim()) return setError('Please describe the issue.');
        if (form.description.trim().length < 20) return setError('Description should be at least 20 characters.');

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('issueType',   form.issueType);
            fd.append('title',       form.title.trim());
            fd.append('description', form.description.trim());
            fd.append('priority',    form.priority);
            fd.append('pageUrl',     window.location.href);
            fd.append('deviceInfo',  getDeviceInfo());
            if (screenshot) fd.append('screenshot', screenshot);

            await api.post('/issues/report', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccess(true);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to submit. Please try again.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Overlay click to close ───────────────────────────────────────────────
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose();
    };

    // ── Shared input style ───────────────────────────────────────────────────
    const inputStyle = {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '10px 14px',
        color: '#fff',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: 'inherit',
    };
    const labelStyle = {
        display: 'block',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 6,
    };

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                animation: 'fadeIn 0.18s ease',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#111118',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 24,
                    width: '100%',
                    maxWidth: 520,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
                    animation: 'slideUp 0.25s ease',
                }}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div style={{
                    padding: '22px 24px 0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                }}>
                    <div>
                        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0 }}>
                            Report an Issue
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, margin: '4px 0 0' }}>
                            Help us improve Fannex. We review every report.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: 'none',
                            borderRadius: 10,
                            width: 36, height: 36,
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.5)',
                            fontSize: 18,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                        aria-label="Close"
                    >×</button>
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0 0' }} />

                {/* ── Success state ─────────────────────────────────────────── */}
                {success ? (
                    <div style={{ padding: '40px 24px 32px', textAlign: 'center' }}>
                        <div style={{
                            width: 72, height: 72,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                            fontSize: 32,
                            boxShadow: '0 0 35px rgba(34,197,94,0.3)',
                        }}>✓</div>
                        <h3 style={{ color: '#fff', fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}>
                            Report Submitted!
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
                            Thank you. Your report has been submitted. Our team will review it soon.
                        </p>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'linear-gradient(90deg, #cc52b8, #7b5cff)',
                                border: 'none',
                                borderRadius: 12,
                                padding: '12px 28px',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: 'pointer',
                            }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    /* ── Form ─────────────────────────────────────────────── */
                    <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Issue Type */}
                            <div>
                                <label style={labelStyle}>Issue Type *</label>
                                <select
                                    name="issueType"
                                    value={form.issueType}
                                    onChange={handleChange}
                                    required
                                    style={{
                                        ...inputStyle,
                                        cursor: 'pointer',
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.3)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 12px center',
                                        backgroundSize: '18px',
                                        paddingRight: 36,
                                    }}
                                    onFocus={(e) => { e.target.style.borderColor = 'rgba(204,82,184,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,82,184,0.12)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                                >
                                    <option value="" disabled style={{ background: '#1a1a2e' }}>Select an issue type…</option>
                                    {ISSUE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value} style={{ background: '#1a1a2e' }}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Title */}
                            <div>
                                <label style={labelStyle}>Title *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Payment failed but money was deducted"
                                    maxLength={150}
                                    required
                                    style={{ ...inputStyle }}
                                    onFocus={(e) => { e.target.style.borderColor = 'rgba(204,82,184,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,82,184,0.12)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                                />
                                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4, textAlign: 'right' }}>{form.title.length}/150</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label style={labelStyle}>Description *</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Please describe the issue in detail. Include what you were doing, what happened, and what you expected to happen."
                                    rows={5}
                                    maxLength={3000}
                                    required
                                    style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }}
                                    onFocus={(e) => { e.target.style.borderColor = 'rgba(204,82,184,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,82,184,0.12)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                                />
                                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4, textAlign: 'right' }}>{form.description.length}/3000</p>
                            </div>

                            {/* Priority */}
                            <div>
                                <label style={labelStyle}>Priority</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {PRIORITIES.map((p) => {
                                        const selected = form.priority === p.value;
                                        return (
                                            <button
                                                key={p.value}
                                                type="button"
                                                onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 6px',
                                                    borderRadius: 10,
                                                    border: selected ? '1.5px solid rgba(204,82,184,0.6)' : '1px solid rgba(255,255,255,0.08)',
                                                    background: selected ? 'rgba(204,82,184,0.1)' : 'rgba(255,255,255,0.03)',
                                                    color: selected ? '#cc52b8' : 'rgba(255,255,255,0.45)',
                                                    cursor: 'pointer',
                                                    fontSize: 12,
                                                    fontWeight: selected ? 700 : 500,
                                                    textAlign: 'center',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Screenshot upload */}
                            <div>
                                <label style={labelStyle}>Screenshot <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(optional — max 5 MB)</span></label>
                                {screenshotPreview ? (
                                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <img
                                            src={screenshotPreview}
                                            alt="Screenshot preview"
                                            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveScreenshot}
                                            style={{
                                                position: 'absolute', top: 8, right: 8,
                                                background: 'rgba(0,0,0,0.7)',
                                                border: 'none', borderRadius: 8,
                                                color: '#fff', fontSize: 12,
                                                padding: '4px 8px', cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >✕ Remove</button>
                                    </div>
                                ) : (
                                    <label
                                        style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            gap: 8,
                                            padding: '20px 16px',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1.5px dashed rgba(255,255,255,0.1)',
                                            borderRadius: 12,
                                            cursor: 'pointer',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(204,82,184,0.4)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                    >
                                        <span style={{ fontSize: 28 }}>📎</span>
                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Click to attach a screenshot</span>
                                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>PNG, JPG or WebP</span>
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Auto-captured info notice */}
                            <div style={{
                                background: 'rgba(124,58,237,0.06)',
                                border: '1px solid rgba(124,58,237,0.15)',
                                borderRadius: 10,
                                padding: '10px 14px',
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                            }}>
                                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                                    We'll automatically include the <strong style={{ color: 'rgba(255,255,255,0.5)' }}>current page URL</strong> and <strong style={{ color: 'rgba(255,255,255,0.5)' }}>device info</strong> to help us reproduce the issue.
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 10,
                                    padding: '10px 14px',
                                    color: '#f87171',
                                    fontSize: 13,
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    background: 'linear-gradient(90deg, #cc52b8, #7b5cff)',
                                    border: 'none',
                                    borderRadius: 12,
                                    padding: '13px 20px',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: 14.5,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.65 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    transition: 'opacity 0.2s',
                                    boxShadow: '0 4px 20px rgba(123,92,255,0.3)',
                                }}
                            >
                                {submitting ? (
                                    <>
                                        <span style={{
                                            width: 16, height: 16,
                                            border: '2px solid rgba(255,255,255,0.35)',
                                            borderTopColor: '#fff',
                                            borderRadius: '50%',
                                            animation: 'spin 0.7s linear infinite',
                                            display: 'inline-block',
                                        }} />
                                        Submitting…
                                    </>
                                ) : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <style>{`
                @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
                @keyframes spin    { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    );
}
