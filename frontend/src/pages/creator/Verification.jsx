import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Input from '../../components/Input';
import { getErrorMessage } from '../../utils/helpers';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS = {
    pending: { bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '⏳', label: 'Under Review' },
    approved: { bg: 'bg-green-500/20  text-green-400  border-green-500/30', icon: '✅', label: 'Verified' },
    rejected: { bg: 'bg-red-500/20    text-red-400    border-red-500/30', icon: '❌', label: 'Rejected' },
};

function StatusBanner({ status, rejectionReason }) {
    const s = STATUS[status];
    if (!s) return null;
    return (
        <div className={`glass rounded-xl px-5 py-4 border mb-8 ${s.bg}`}>
            <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">{s.icon}</span>
                <span className="font-semibold">{s.label}</span>
            </div>
            {status === 'pending' && <p className="text-sm opacity-80">Our team will review your documents within 1–3 business days.</p>}
            {status === 'approved' && <p className="text-sm opacity-80">Your creator account is verified. You can now request payouts.</p>}
            {status === 'rejected' && rejectionReason && (
                <p className="text-sm opacity-80">Reason: <span className="font-medium">{rejectionReason}</span></p>
            )}
        </div>
    );
}

// ── File upload row ───────────────────────────────────────────────────────────
function DocUpload({ label, name, accept = 'image/*,.pdf', files, onChange }) {
    const ref = useRef();
    const f = files[name];
    return (
        <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">{label}</label>
            <div
                onClick={() => ref.current?.click()}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${f ? 'border-brand-500/50 bg-brand-500/5' : 'border-surface-600 hover:border-brand-500/40 glass'
                    }`}
            >
                <span className="text-xl">{f ? '📎' : '📁'}</span>
                <div className="flex-1 min-w-0">
                    {f
                        ? <><p className="text-sm text-brand-400 truncate">{f.name}</p><p className="text-xs text-surface-500">{(f.size / 1024).toFixed(0)} KB</p></>
                        : <p className="text-sm text-surface-400">Click to upload {label.toLowerCase()}</p>}
                </div>
                {f && <button type="button" onClick={(e) => { e.stopPropagation(); onChange(name, null); }}
                    className="text-surface-500 hover:text-red-400 text-xs">✕</button>}
            </div>
            <input ref={ref} type="file" accept={accept} className="hidden"
                onChange={(e) => onChange(name, e.target.files?.[0] ?? null)} />
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Verification() {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();

    const [verificationStatus, setVerStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'
    const [rejectionReason, setRejection] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState('');
    const [files, setFiles] = useState({
        aadhaarImage: null,
        panImage: null,
        bankProof: null,
    });

    const { register, handleSubmit, formState: { errors } } = useForm();

    // Check existing verification status
    useEffect(() => {
        api.get('/verification/my')
            .then(({ data }) => {
                setVerStatus(data.data?.status ?? null);
                setRejection(data.data?.rejectionReason ?? '');
            })
            .catch(() => { }) // 404 = no submission yet
            .finally(() => setLoadingStatus(false));
    }, []);

    const setFile = (name, val) => setFiles((f) => ({ ...f, [name]: val }));

    const onSubmit = async (data) => {
        const missing = [];
        if (!files.aadhaarImage) missing.push('Aadhaar image');
        if (!files.panImage) missing.push('PAN image');
        if (!files.bankProof) missing.push('Bank proof');
        if (missing.length) { setServerError(`Please upload: ${missing.join(', ')}`); return; }

        setServerError('');
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('aadhaarNumber', data.aadhaarNumber.replace(/\s/g, ''));
            fd.append('pan', data.pan.toUpperCase().trim());
            fd.append('bankAccount', data.bankAccount.trim());
            fd.append('ifsc', data.ifsc.toUpperCase().trim());
            fd.append('fullName', data.fullName.trim());
            fd.append('dateOfBirth', data.dateOfBirth);
            // Address
            fd.append('address[street]', data.street);
            fd.append('address[city]', data.city);
            fd.append('address[state]', data.state);
            fd.append('address[postalCode]', data.postalCode);
            fd.append('address[country]', 'India');
            // Documents
            fd.append('aadhaarImage', files.aadhaarImage);
            fd.append('panImage', files.panImage);
            fd.append('bankProof', files.bankProof);

            await api.post('/verification', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await refreshUser();
            setVerStatus('pending');
        } catch (err) {
            setServerError(getErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loadingStatus) return (
        <div className="p-6 max-w-xl">
            <div className="skeleton h-8 w-48 mb-4" />
            <div className="skeleton h-20 rounded-xl mb-4" />
            <div className="skeleton h-12 rounded-xl mb-3" />
            <div className="skeleton h-12 rounded-xl" />
        </div>
    );

    return (
        <div className="p-6 max-w-xl">
            <h1 className="text-3xl font-black text-white mb-2">KYC Verification</h1>
            <p className="text-surface-400 mb-8">
                Verify your identity to unlock payouts and earn your verified creator badge.
            </p>

            {/* Current status banner */}
            {verificationStatus && (
                <StatusBanner status={verificationStatus} rejectionReason={rejectionReason} />
            )}

            {/* If approved — done */}
            {verificationStatus === 'approved' && (
                <div className="flex gap-3">
                    <button onClick={() => navigate('/dashboard')} className="btn-brand px-8 py-3">
                        Go to Dashboard
                    </button>
                    <button onClick={() => navigate('/earnings')} className="btn-outline px-8 py-3">
                        Request Payout
                    </button>
                </div>
            )}

            {/* If pending — view only */}
            {verificationStatus === 'pending' && (
                <p className="text-sm text-surface-400 text-center py-4">
                    Your documents are under review. We'll notify you by email.
                </p>
            )}

            {/* Form — show for new submission or re-submission after rejection */}
            {(!verificationStatus || verificationStatus === 'rejected') && (
                <>
                    {verificationStatus === 'rejected' && (
                        <p className="text-sm text-brand-400 mb-6 font-medium">Please correct your submission and resubmit.</p>
                    )}

                    {serverError && (
                        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {serverError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

                        {/* ── Section: Personal ──────────────────────────────────────── */}
                        <SectionHeader>Personal Information</SectionHeader>

                        <Input label="Full Legal Name" placeholder="As on Aadhaar / PAN"
                            error={errors.fullName?.message}
                            {...register('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })} />

                        <Input label="Date of Birth" type="date"
                            error={errors.dateOfBirth?.message}
                            {...register('dateOfBirth', { required: 'Required' })} />

                        {/* ── Section: KYC Numbers ──────────────────────────────────── */}
                        <SectionHeader>KYC Details</SectionHeader>

                        <Input label="Aadhaar Number" placeholder="XXXX XXXX XXXX"
                            error={errors.aadhaarNumber?.message}
                            {...register('aadhaarNumber', {
                                required: 'Required',
                                pattern: { value: /^\d{4}\s?\d{4}\s?\d{4}$/, message: '12-digit Aadhaar number' },
                            })} />

                        <Input label="PAN Number" placeholder="ABCDE1234F"
                            error={errors.pan?.message}
                            {...register('pan', {
                                required: 'Required',
                                pattern: { value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, message: 'Invalid PAN format (e.g. ABCDE1234F)' },
                            })} />

                        {/* ── Section: Bank Details ─────────────────────────────────── */}
                        <SectionHeader>Bank Account</SectionHeader>

                        <Input label="Account Number" placeholder="Your bank account number"
                            error={errors.bankAccount?.message}
                            {...register('bankAccount', {
                                required: 'Required',
                                pattern: { value: /^\d{9,18}$/, message: '9–18 digit account number' },
                            })} />

                        <Input label="IFSC Code" placeholder="SBIN0001234"
                            error={errors.ifsc?.message}
                            {...register('ifsc', {
                                required: 'Required',
                                pattern: { value: /^[A-Z]{4}0[A-Z0-9]{6}$/i, message: 'Invalid IFSC code' },
                            })} />

                        {/* ── Section: Address ──────────────────────────────────────── */}
                        <SectionHeader>Address</SectionHeader>

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Street" placeholder="123 MG Road" error={errors.street?.message}      {...register('street', { required: 'Required' })} />
                            <Input label="City" placeholder="Mumbai" error={errors.city?.message}        {...register('city', { required: 'Required' })} />
                            <Input label="State" placeholder="Maharashtra" error={errors.state?.message}       {...register('state', { required: 'Required' })} />
                            <Input label="Postal Code" placeholder="400001" error={errors.postalCode?.message}  {...register('postalCode', { required: 'Required', pattern: { value: /^\d{6}$/, message: '6-digit PIN code' } })} />
                        </div>

                        {/* ── Section: Documents ───────────────────────────────────── */}
                        <SectionHeader>Upload Documents</SectionHeader>
                        <p className="text-xs text-surface-500 -mt-2">Clear photos or scans of original documents only.</p>

                        <DocUpload label="Aadhaar Card" name="aadhaarImage" files={files} onChange={setFile} />
                        <DocUpload label="PAN Card" name="panImage" files={files} onChange={setFile} />
                        <DocUpload label="Bank Proof (cancelled cheque or statement)" name="bankProof" files={files} onChange={setFile} />

                        {/* ── Submit ────────────────────────────────────────────────── */}
                        <button type="submit" disabled={submitting} className="btn-brand w-full py-3 text-base mt-2">
                            {submitting
                                ? <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Submitting…
                                </span>
                                : '📤 Submit for Review'}
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}

function SectionHeader({ children }) {
    return (
        <div className="pt-2">
            <p className="text-xs uppercase tracking-widest text-surface-500 font-semibold">{children}</p>
            <div className="h-px bg-surface-700 mt-2" />
        </div>
    );
}
