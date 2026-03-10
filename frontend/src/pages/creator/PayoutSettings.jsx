import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';

// ── Inline styles ────────────────────────────────────────────────────────────
const S = {
    page: {
        padding: '24px 20px',
        maxWidth: 560,
        fontFamily: 'inherit',
    },
    header: { marginBottom: 24 },
    h1: {
        fontSize: 'clamp(22px, 5vw, 28px)',
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '-0.03em',
        margin: 0,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        marginTop: 6,
    },
    infoBanner: {
        background: 'rgba(251,191,36,0.07)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 24,
    },
    infoBannerText: {
        color: 'rgba(253,224,71,0.8)',
        fontSize: 13.5,
        lineHeight: 1.55,
        margin: 0,
    },
    section: { marginBottom: 24 },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 12,
    },
    // ── Existing account card ──
    maskedCard: {
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(168,85,247,0.04))',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 20,
        padding: '20px 20px 16px',
        position: 'relative',
        overflow: 'hidden',
    },
    maskedCardGlow: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)',
        pointerEvents: 'none',
    },
    maskedCardRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginBottom: 16,
    },
    bankIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.2))',
        border: '1px solid rgba(168,85,247,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
    },
    maskedLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 3,
    },
    maskedValue: {
        fontSize: 15,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.1em',
    },
    verifiedBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.25)',
        borderRadius: 999,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 700,
        color: '#4ade80',
        marginBottom: 16,
    },
    changeBtn: {
        width: '100%',
        padding: '13px 20px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.65)',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s ease',
    },
    // ── Empty state ──
    emptyCard: {
        background: 'rgba(255,255,255,0.02)',
        border: '1.5px dashed rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '36px 20px',
        textAlign: 'center',
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 14,
        marginBottom: 20,
    },
    // ── Form card ──
    formCard: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '24px 20px',
        marginBottom: 24,
    },
    formHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 22,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: 800,
        color: '#fff',
        letterSpacing: '-0.02em',
    },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
        display: 'block',
        fontSize: 11.5,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 7,
    },
    input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        color: '#fff',
        fontSize: 14,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    uploadArea: {
        borderRadius: 12,
        border: '1.5px dashed rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.02)',
        padding: '16px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    errorBox: {
        padding: '11px 14px',
        borderRadius: 12,
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171',
        fontSize: 13.5,
        marginBottom: 16,
    },
    successBox: {
        padding: '11px 14px',
        borderRadius: 12,
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.2)',
        color: '#4ade80',
        fontSize: 13.5,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    // ── Payout info card ──
    infoCard: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '20px 20px',
    },
    stepRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 14,
    },
    stepNum: {
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: 'rgba(124,58,237,0.15)',
        border: '1px solid rgba(124,58,237,0.25)',
        color: '#a78bfa',
        fontSize: 12,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
    },
    stepText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13.5,
        lineHeight: 1.5,
        margin: 0,
    },
};

// ── Primary CTA button shared style ─────────────────────────────────────────
const primaryBtn = {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    boxShadow: '0 6px 24px rgba(124,58,237,0.35)',
    border: 'none',
    color: '#fff',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    letterSpacing: '-0.01em',
};

const outlineBtn = {
    padding: '13px 20px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
};

// ── Form fields config ───────────────────────────────────────────────────────
const FIELDS = [
    { name: 'accountHolderName', label: 'Account Holder Name', placeholder: 'Full name as on bank records', type: 'text' },
    { name: 'bankName', label: 'Bank Name (optional)', placeholder: 'e.g. State Bank of India', type: 'text' },
    { name: 'accountNumber', label: 'Account Number', placeholder: 'Enter account number', type: 'password', required: true },
    { name: 'confirmAccountNumber', label: 'Confirm Account Number', placeholder: 'Re-enter account number', type: 'text', required: true },
    { name: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', type: 'text', required: true },
];

const PAYOUT_STEPS = [
    'Go to Earnings → Request Payout when you have a balance.',
    'Fannex team reviews your request within 2 business days.',
    'Funds transferred to the registered bank account via IMPS/NEFT.',
    'Minimum payout: ₹500 · Platform fee: 20% of gross earnings.',
];

// ── Main component ───────────────────────────────────────────────────────────
export default function PayoutSettings() {
    const { user } = useAuth();

    const [hasAccount, setHasAccount] = useState(false);  // true = account exists
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        accountHolderName: '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        bankName: '',
    });
    const [bankProof, setBankProof] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ── Load — only check if an account exists (don't expose bank details) ──
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/creator/status');
                const vData = data.data?.verificationData;
                // Account exists if bankAccountNumber is stored
                setHasAccount(!!(vData?.bankAccountNumber));
            } catch (_) { }
            finally { setLoading(false); }
        };
        load();
    }, [user]);

    const handleChange = (e) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
        setError('');
    };

    const openForm = () => {
        setForm({ accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '' });
        setBankProof(null);
        setError('');
        setSuccess('');
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (form.accountNumber !== form.confirmAccountNumber) {
            setError('Account numbers do not match. Please re-enter.'); return;
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifscCode)) {
            setError('Invalid IFSC code format (e.g. SBIN0001234).'); return;
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('accountHolderName', form.accountHolderName.trim());
            fd.append('accountNumber', form.accountNumber.trim());
            fd.append('ifscCode', form.ifscCode.trim().toUpperCase());
            fd.append('bankName', form.bankName.trim());
            if (bankProof) fd.append('bankProofImage', bankProof);

            await api.patch('/creator/payout-account', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setSuccess('Bank account updated! It will be used for your next payout.');
            setHasAccount(true);
            setShowForm(false);
            setForm({ accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '' });
            setBankProof(null);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={S.page}>

            {/* Header */}
            <div style={S.header}>
                <h1 style={S.h1}>💳 Payout Settings</h1>
                <p style={S.subtitle}>Manage where your earnings are sent.</p>
            </div>

            {/* Info banner */}
            <div style={S.infoBanner}>
                <span style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }}>ℹ️</span>
                <p style={S.infoBannerText}>
                    Payouts are processed manually by the Fannex team every week.
                    Make sure your payment details are up to date before requesting a payout.
                </p>
            </div>

            {/* Success message */}
            {success && (
                <div style={S.successBox}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                </div>
            )}

            {/* ── Bank Account Section ── */}
            <div style={S.section}>
                <p style={S.sectionTitle}>Payment Account</p>

                {loading ? (
                    // Skeleton
                    <div style={{ ...S.maskedCard, padding: 20 }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.05)' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 8 }} />
                                <div style={{ height: 10, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                            </div>
                        </div>
                    </div>

                ) : hasAccount && !showForm ? (
                    // ── Existing account — masked, no details shown ──
                    <div style={S.maskedCard}>
                        <div style={S.maskedCardGlow} />

                        <div style={S.maskedCardRow}>
                            <div style={S.bankIconWrap}>🏦</div>
                            <div>
                                <p style={S.maskedLabel}>Registered Account</p>
                                <p style={S.maskedValue}>•••• •••• ••••</p>
                            </div>
                        </div>

                        <div style={S.verifiedBadge}>
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Payment account on file
                        </div>

                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
                            Your bank details are securely stored. For security, existing account details are not displayed.
                            Submit new details below to change your payment account.
                        </p>

                        <button
                            style={S.changeBtn}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(124,58,237,0.1)';
                                e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)';
                                e.currentTarget.style.color = '#a78bfa';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                            }}
                            onClick={openForm}
                        >
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Set Up New Payment Account
                        </button>
                    </div>

                ) : !hasAccount && !showForm ? (
                    // ── No account — empty state ──
                    <div style={S.emptyCard}>
                        <div style={S.emptyIcon}>🏦</div>
                        <p style={S.emptyText}>No payment account added yet.</p>
                        <button
                            style={{ ...primaryBtn, width: 'auto', padding: '13px 28px', fontSize: 14 }}
                            onClick={openForm}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(124,58,237,0.45)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.35)'; }}
                        >
                            + Add Bank Account
                        </button>
                    </div>

                ) : null}
            </div>

            {/* ── New Payment Setup Form ── */}
            {showForm && (
                <div style={S.formCard}>
                    <div style={S.formHeader}>
                        <div>
                            <p style={S.formTitle}>New Payment Setup</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12.5, marginTop: 3 }}>
                                {hasAccount ? 'This will replace your existing payment account.' : 'Enter your bank details for payouts.'}
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowForm(false); setError(''); }}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4, lineHeight: 1 }}
                            aria-label="Close form"
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>

                        {FIELDS.map(({ name, label, placeholder, type, required = (name !== 'bankName') }) => (
                            <div key={name} style={S.inputGroup}>
                                <label style={S.inputLabel}>{label}</label>
                                <input
                                    type={type}
                                    name={name}
                                    value={form[name]}
                                    onChange={handleChange}
                                    placeholder={placeholder}
                                    required={required}
                                    autoComplete="off"
                                    style={S.input}
                                    onFocus={e => { e.target.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                />
                            </div>
                        ))}

                        {/* Bank proof upload */}
                        <div style={S.inputGroup}>
                            <label style={S.inputLabel}>Bank Proof <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', fontWeight: 500 }}>(passbook / cancelled cheque)</span></label>
                            <div
                                style={S.uploadArea}
                                onClick={() => document.getElementById('bankProofInput').click()}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            >
                                <span style={{ fontSize: 22, flexShrink: 0 }}>{bankProof ? '📄' : '📎'}</span>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ color: bankProof ? '#a78bfa' : 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {bankProof ? bankProof.name : 'Click to upload bank proof'}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11.5, margin: '3px 0 0' }}>
                                        JPG, PNG · max 5 MB
                                    </p>
                                </div>
                                {bankProof && (
                                    <button
                                        type="button"
                                        onClick={ev => { ev.stopPropagation(); setBankProof(null); }}
                                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0, fontSize: 16, lineHeight: 1 }}
                                    >✕</button>
                                )}
                            </div>
                            <input
                                id="bankProofInput"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f && f.size > 5 * 1024 * 1024) { setError('File must be under 5MB.'); return; }
                                    setBankProof(f || null);
                                    e.target.value = '';
                                }}
                            />
                        </div>

                        {/* Error */}
                        {error && <div style={S.errorBox}>{error}</div>}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <button
                                type="button"
                                style={{ ...outlineBtn, flex: '0 0 auto', padding: '13px 20px' }}
                                onClick={() => { setShowForm(false); setError(''); }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{ ...primaryBtn, flex: 1, opacity: saving ? 0.65 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                                onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(124,58,237,0.5)'; } }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.35)'; }}
                            >
                                {saving ? (
                                    <>
                                        <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.75s linear infinite', display: 'inline-block' }} />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Save Payment Account
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── How Payouts Work ── */}
            <div style={S.infoCard}>
                <p style={{ ...S.sectionTitle, marginBottom: 16 }}>How Payouts Work</p>
                {PAYOUT_STEPS.map((text, i) => (
                    <div key={i} style={{ ...S.stepRow, marginBottom: i === PAYOUT_STEPS.length - 1 ? 0 : 14 }}>
                        <div style={S.stepNum}>{i + 1}</div>
                        <p style={S.stepText}>{text}</p>
                    </div>
                ))}
            </div>

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
