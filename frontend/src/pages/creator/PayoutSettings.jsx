import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { getErrorMessage, formatCurrency } from '../../utils/helpers';

// ──────────────────────────────────────────────────────────────────────────────
// Bank account card
// ──────────────────────────────────────────────────────────────────────────────
function BankCard({ account, onDelete }) {
    const last4 = account.accountNumber?.slice(-4) || '????';
    return (
        <div className="glass rounded-xl border border-white/5 px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center text-xl flex-shrink-0">
                🏦
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{account.accountHolderName}</p>
                <p className="text-xs text-surface-400 mt-0.5">
                    {account.bankName ? `${account.bankName} • ` : ''}
                    A/C ••••{last4}
                </p>
                <p className="text-xs text-surface-500">{account.ifscCode}</p>
            </div>
            {onDelete && (
                <button onClick={() => onDelete(account._id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0">
                    Remove
                </button>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
export default function PayoutSettings() {
    const { user } = useAuth();

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
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

    // Load existing bank details from creator verification
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/creator/status');
                const vData = data.data?.verificationData;
                if (vData?.bankAccountNumber) {
                    setAccounts([{
                        _id: 'primary',
                        accountHolderName: vData.fullName || user?.name || '',
                        accountNumber: vData.bankAccountNumber,
                        ifscCode: vData.ifscCode || '',
                        bankName: '',
                    }]);
                }
            } catch (_) { }
            finally { setLoading(false); }
        };
        load();
    }, [user]);

    const handleChange = (e) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (form.accountNumber !== form.confirmAccountNumber) {
            setError('Account numbers do not match.'); return;
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

            setSuccess('Bank account updated successfully!');
            setAccounts([{
                _id: 'primary',
                accountHolderName: form.accountHolderName,
                accountNumber: form.accountNumber,
                ifscCode: form.ifscCode.toUpperCase(),
                bankName: form.bankName,
            }]);
            setShowForm(false);
            setForm({ accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '' });
            setBankProof(null);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-black text-white">💳 Payout Settings</h1>
                <p className="text-surface-400 mt-1.5 text-sm">Manage where your earnings are sent.</p>
            </div>

            {/* Info banner */}
            <div className="glass rounded-xl border border-amber-500/20 px-4 py-3 flex items-start gap-3 mb-6">
                <span className="text-amber-400 text-lg mt-0.5">ℹ️</span>
                <p className="text-sm text-amber-300/80">
                    Payouts are processed manually by the Fannex team every week. Make sure your bank details are correct before requesting a payout.
                </p>
            </div>

            {/* Success message */}
            {success && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {success}
                </div>
            )}

            {/* Existing accounts */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-white">Bank Accounts</h2>
                    {!showForm && (
                        <button onClick={() => setShowForm(true)}
                            className="btn-brand text-xs px-4 py-1.5 rounded-xl">
                            + Add / Update Account
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="glass rounded-xl border border-white/5 p-4 animate-pulse">
                        <div className="flex gap-3 items-center">
                            <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                            <div className="flex-1"><div className="skeleton h-4 w-32 mb-1.5" /><div className="skeleton h-3 w-24" /></div>
                        </div>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="glass rounded-xl border border-dashed border-white/10 p-8 text-center text-surface-500">
                        <div className="text-4xl mb-2">🏦</div>
                        <p className="text-sm">No bank account added yet.</p>
                        <button onClick={() => setShowForm(true)} className="btn-brand text-xs px-4 py-1.5 rounded-xl mt-3">
                            + Add Bank Account
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {accounts.map(acc => (
                            <BankCard key={acc._id} account={acc} />
                        ))}
                    </div>
                )}
            </div>

            {/* Add / Update form */}
            {showForm && (
                <div className="glass rounded-2xl border border-white/10 p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white">Add / Update Bank Account</h3>
                        <button onClick={() => { setShowForm(false); setError(''); }}
                            className="text-surface-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                        {[
                            { name: 'accountHolderName', label: 'Account Holder Name', placeholder: 'As on bank records' },
                            { name: 'bankName', label: 'Bank Name (optional)', placeholder: 'e.g. State Bank of India' },
                            { name: 'accountNumber', label: 'Account Number', placeholder: '••••••••••', type: 'password' },
                            { name: 'confirmAccountNumber', label: 'Confirm Account Number', placeholder: 'Re-enter account number' },
                            { name: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234' },
                        ].map(({ name, label, placeholder, type }) => (
                            <div key={name}>
                                <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5 block">{label}</label>
                                <input
                                    type={type || 'text'}
                                    name={name}
                                    value={form[name]}
                                    onChange={handleChange}
                                    placeholder={placeholder}
                                    required={name !== 'bankName'}
                                    className="input-dark w-full"
                                />
                            </div>
                        ))}

                        {/* Bank proof upload */}
                        <div>
                            <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5 block">
                                Bank Proof (passbook / cancelled cheque)
                            </label>
                            <div
                                onClick={() => document.getElementById('bankProofInput').click()}
                                className="glass rounded-xl border border-dashed border-surface-600 hover:border-brand-500/50 transition-all cursor-pointer p-4 flex items-center gap-3"
                            >
                                <span className="text-2xl">{bankProof ? '📄' : '📎'}</span>
                                <div>
                                    <p className="text-sm text-white">
                                        {bankProof ? bankProof.name : 'Click to upload bank proof'}
                                    </p>
                                    <p className="text-xs text-surface-500">JPG, PNG (max 5MB)</p>
                                </div>
                            </div>
                            <input
                                id="bankProofInput"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => setBankProof(e.target.files?.[0] || null)}
                            />
                        </div>

                        {error && (
                            <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                                className="btn-outline flex-1 py-2.5 text-sm">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="btn-brand flex-1 py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                                {saving
                                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                                    : '✓ Save Account'
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Payout process info */}
            <div className="glass rounded-2xl border border-white/5 p-5">
                <h3 className="font-bold text-white mb-3">How Payouts Work</h3>
                <div className="flex flex-col gap-2.5">
                    {[
                        { step: '1', text: 'Go to Earnings → Request Payout when you have a balance.' },
                        { step: '2', text: 'Fannex team reviews your request within 2 business days.' },
                        { step: '3', text: 'Funds transferred to the bank account above via IMPS/NEFT.' },
                        { step: '4', text: 'Min payout: ₹500. Platform fee: 20% of gross earnings.' },
                    ].map(({ step, text }) => (
                        <div key={step} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                                {step}
                            </div>
                            <p className="text-sm text-surface-400">{text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
