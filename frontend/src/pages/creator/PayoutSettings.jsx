import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';

/* ─── tiny helpers ──────────────────────────────────────────────────────────── */
const mask = (str = '', show = 4) =>
    str.length <= show ? str : '••••' + str.slice(-show);

/* ─── PAYOUT_STEPS ──────────────────────────────────────────────────────────── */
const STEPS = [
    { icon: '💰', text: 'Go to Earnings → Request Payout when you have a balance.' },
    { icon: '🔍', text: 'Fannex team reviews your request within 2 business days.' },
    { icon: '🏦', text: 'Funds transferred to your registered bank account via IMPS / NEFT.' },
    { icon: '📋', text: 'Minimum payout: ₹500 · Platform fee: 20% of gross earnings.' },
];

/* ─── FIELD CONFIG ──────────────────────────────────────────────────────────── */
const FIELDS = [
    { name: 'accountHolderName', label: 'Account Holder Name', placeholder: 'Full name as on bank records', type: 'text' },
    { name: 'bankName', label: 'Bank Name (optional)', placeholder: 'e.g. State Bank of India', type: 'text' },
    { name: 'accountNumber', label: 'Account Number', placeholder: 'Enter account number', type: 'password', required: true },
    { name: 'confirmAccountNumber', label: 'Confirm Account Number', placeholder: 'Re-enter account number', type: 'text', required: true },
    { name: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', type: 'text', required: true },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function PayoutSettings() {
    const { user } = useAuth();

    /* state */
    const [bank, setBank] = useState(null);   // { name, last4, ifsc, holder }
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    const [form, setForm] = useState({
        accountHolderName: '', bankName: '',
        accountNumber: '', confirmAccountNumber: '', ifscCode: '',
    });
    const [proof, setProof] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const proofRef = useRef();

    /* ── load ─────────────────────────────────────────────────────────────── */
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/creator/status');
                const v = data.data?.verificationData;
                if (v?.bankAccountNumber) {
                    setBank({
                        holder: v.fullName || user?.name || '',
                        last4: v.bankAccountNumber.slice(-4),
                        ifsc: v.ifscCode || '',
                        name: '',
                    });
                }
            } catch (_) { }
            finally { setLoading(false); }
        })();
    }, [user]);

    /* ── form helpers ─────────────────────────────────────────────────────── */
    const openEdit = () => {
        setForm({
            accountHolderName: bank?.holder || '', bankName: bank?.name || '',
            accountNumber: '', confirmAccountNumber: '', ifscCode: bank?.ifsc || ''
        });
        setProof(null); setError(''); setSuccess(''); setEditing(true);
    };
    const closeEdit = () => { setEditing(false); setError(''); };

    const handleChange = (e) => { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(''); };

    const handleProof = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return; }
        setProof(f);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (form.accountNumber !== form.confirmAccountNumber) { setError('Account numbers do not match.'); return; }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifscCode)) { setError('Invalid IFSC code (e.g. SBIN0001234).'); return; }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('accountHolderName', form.accountHolderName.trim());
            fd.append('accountNumber', form.accountNumber.trim());
            fd.append('ifscCode', form.ifscCode.trim().toUpperCase());
            fd.append('bankName', form.bankName.trim());
            if (proof) fd.append('bankProofImage', proof);

            await api.patch('/creator/payout-account', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

            setBank({
                holder: form.accountHolderName,
                last4: form.accountNumber.slice(-4),
                ifsc: form.ifscCode.toUpperCase(),
                name: form.bankName,
            });
            setSuccess('Bank account updated successfully!');
            setEditing(false);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally { setSaving(false); }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════════════════ */
    return (
        <div style={{ maxWidth: 580, padding: '28px 20px', fontFamily: 'inherit' }}>

            {/* ── Page header ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: 0 }}>
                    💳 Payout Settings
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, marginTop: 6 }}>
                    Manage where your earnings are sent.
                </p>
            </div>

            {/* ── Info banner ────────────────────────────────────────────── */}
            <div style={{
                background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)',
                borderRadius: 16, padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28,
            }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                <p style={{ color: 'rgba(253,224,71,0.8)', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
                    Payouts are processed manually by the Fannex team every week.
                    Keep your bank details up to date before requesting a payout.
                </p>
            </div>

            {/* ── Success toast ──────────────────────────────────────────── */}
            {success && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)',
                    borderRadius: 14, padding: '12px 16px', marginBottom: 22,
                    color: '#4ade80', fontSize: 14, fontWeight: 600,
                }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                SECTION: Bank Account
            ════════════════════════════════════════════════════════════ */}
            <SectionLabel>Bank Account</SectionLabel>

            {loading ? (
                <SkeletonCard />
            ) : !bank ? (
                /* ── No account ──────────────────────────────────────── */
                <EmptyCard onAdd={() => { setEditing(true); setForm({ accountHolderName: '', bankName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '' }); setProof(null); setError(''); setSuccess(''); }} />
            ) : !editing ? (
                /* ── Existing account card ───────────────────────────── */
                <BankCard bank={bank} onEdit={openEdit} />
            ) : null}

            {/* ── Edit / Add form ──────────────────────────────────────── */}
            {editing && (
                <PayoutForm
                    form={form} onChange={handleChange}
                    proof={proof} proofRef={proofRef} onProof={handleProof} onRemoveProof={() => setProof(null)}
                    saving={saving} error={error}
                    isUpdate={!!bank}
                    onCancel={closeEdit}
                    onSubmit={handleSubmit}
                />
            )}

            {/* ════════════════════════════════════════════════════════════
                SECTION: How Payouts Work
            ════════════════════════════════════════════════════════════ */}
            <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20, padding: '22px 20px', marginTop: 28,
            }}>
                <SectionLabel style={{ marginBottom: 16 }}>How Payouts Work</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {STEPS.map(({ icon, text }, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                            }}>{icon}</div>
                            <div>
                                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 700, margin: '0 0 3px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Step {i + 1}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>{text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .payout-input:focus { border-color: rgba(124,58,237,0.55) !important; outline: none; }
                .payout-upload:hover { border-color: rgba(124,58,237,0.4) !important; background: rgba(124,58,237,0.04) !important; }
                .payout-edit-btn:hover { background: rgba(124,58,237,0.12) !important; border-color: rgba(124,58,237,0.35) !important; color: #c4b5fd !important; }
            `}</style>
        </div>
    );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function SectionLabel({ children, style }) {
    return (
        <p style={{ fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12, ...style }}>
            {children}
        </p>
    );
}

function SkeletonCard() {
    return (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '55%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
                    <div style={{ height: 11, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
                </div>
            </div>
        </div>
    );
}

function EmptyCard({ onAdd }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '40px 20px', textAlign: 'center',
        }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏦</div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 22 }}>
                No bank account added yet.
            </p>
            <button
                onClick={onAdd}
                style={{
                    padding: '13px 28px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                    boxShadow: '0 6px 24px rgba(124,58,237,0.35)',
                    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                    letterSpacing: '-0.01em', transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(124,58,237,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.35)'; }}
            >
                + Add Bank Account
            </button>
        </div>
    );
}

function BankCard({ bank, onEdit }) {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.09), rgba(168,85,247,0.05))',
            border: '1px solid rgba(124,58,237,0.28)', borderRadius: 22,
            padding: '20px 20px 18px', position: 'relative', overflow: 'hidden',
        }}>
            {/* glow */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,85,247,0.18),transparent 70%)', pointerEvents: 'none' }} />

            {/* top row: icon + title + edit button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={{
                    width: 52, height: 52, borderRadius: 15, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.28), rgba(168,85,247,0.18))',
                    border: '1px solid rgba(168,85,247,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>🏦</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bank.holder || 'Account Holder'}
                    </p>
                    {bank.name && (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, margin: '3px 0 0' }}>{bank.name}</p>
                    )}
                </div>
                <button
                    className="payout-edit-btn"
                    onClick={onEdit}
                    style={{
                        flexShrink: 0, padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 0.2s',
                    }}
                >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Update
                </button>
            </div>

            {/* detail pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <DetailPill label="Account No." value={`••••${bank.last4}`} />
                {bank.ifsc && <DetailPill label="IFSC" value={bank.ifsc} />}
                <DetailPill label="Status" value="✓ Active" green />
            </div>
        </div>
    );
}

function DetailPill({ label, value, green }) {
    return (
        <div style={{
            background: green ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${green ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10, padding: '8px 14px',
        }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{label}</p>
            <p style={{ color: green ? '#4ade80' : 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.05em', margin: 0 }}>{value}</p>
        </div>
    );
}

function PayoutForm({ form, onChange, proof, proofRef, onProof, onRemoveProof, saving, error, isUpdate, onCancel, onSubmit }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 22, padding: '22px 20px', marginTop: 16,
        }}>
            {/* form header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
                <div>
                    <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', margin: 0 }}>
                        {isUpdate ? '🔄 Update Bank Account' : '➕ Add Bank Account'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12.5, marginTop: 4 }}>
                        {isUpdate ? 'Enter your new bank details. Previous details will be replaced.' : 'Add your bank details to receive payouts.'}
                    </p>
                </div>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1, marginLeft: 12 }}>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <form onSubmit={onSubmit}>
                {FIELDS.map(({ name, label, placeholder, type, required = name !== 'bankName' }) => (
                    <div key={name} style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                            {label}
                        </label>
                        <input
                            className="payout-input"
                            type={type}
                            name={name}
                            value={form[name]}
                            onChange={onChange}
                            placeholder={placeholder}
                            required={required}
                            autoComplete="off"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '12px 14px', borderRadius: 12,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1.5px solid rgba(255,255,255,0.08)',
                                color: '#fff', fontSize: 14, fontFamily: 'inherit',
                            }}
                        />
                    </div>
                ))}

                {/* File upload */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                        Bank Proof <span style={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.2)' }}>(passbook / cancelled cheque)</span>
                    </label>
                    <div
                        className="payout-upload"
                        onClick={() => proofRef.current?.click()}
                        style={{
                            borderRadius: 12, border: '1.5px dashed rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.02)', padding: '14px 14px',
                            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{proof ? '📄' : '📎'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: proof ? '#a78bfa' : 'rgba(255,255,255,0.45)', fontSize: 13.5, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {proof ? proof.name : 'Click to upload bank proof'}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11.5, margin: '3px 0 0' }}>JPG, PNG · max 5 MB</p>
                        </div>
                        {proof && (
                            <button type="button" onClick={e => { e.stopPropagation(); onRemoveProof(); }}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                                ✕
                            </button>
                        )}
                    </div>
                    <input ref={proofRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onProof} />
                </div>

                {/* Error */}
                {error && (
                    <div style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13.5, marginBottom: 18 }}>
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        type="button" onClick={onCancel}
                        style={{ flex: '0 0 auto', padding: '13px 20px', borderRadius: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit" disabled={saving}
                        style={{
                            flex: 1, padding: '13px 20px', borderRadius: 13, border: 'none',
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            boxShadow: '0 6px 24px rgba(124,58,237,0.35)',
                            color: '#fff', fontWeight: 800, fontSize: 15,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.65 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(124,58,237,0.5)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(124,58,237,0.35)'; }}
                    >
                        {saving
                            ? <><span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .75s linear infinite', display: 'inline-block' }} /> Saving…</>
                            : <><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> {isUpdate ? 'Update Account' : 'Save Account'}</>
                        }
                    </button>
                </div>
            </form>
        </div>
    );
}
