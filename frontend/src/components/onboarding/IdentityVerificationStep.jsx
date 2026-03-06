import { useState } from 'react';

function FileField({ label, name, register, required, setValue, watch }) {
    const file = watch(name);
    const [preview, setPreview] = useState(null);

    const handleChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { alert('Max file size is 5MB'); return; }
        setValue(name, f, { shouldValidate: true });
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target.result);
        reader.readAsDataURL(f);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
                {label} {required && <span className="text-brand-500">*</span>}
            </label>
            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all h-28 overflow-hidden relative ${file ? 'border-brand-500/40 bg-brand-500/5' : 'border-surface-600 bg-surface-800/40 hover:border-surface-400'
                }`}>
                {preview ? (
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center gap-1.5 text-surface-500">
                        <span className="text-2xl">📎</span>
                        <span className="text-xs">Click to upload (max 5MB)</span>
                    </div>
                )}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleChange} />
            </label>
            {file && (
                <p className="mt-1 text-xs text-green-400 truncate">✓ {file.name}</p>
            )}
            {/* Hidden validation input */}
            <input type="text" className="sr-only" readOnly value={file ? 'ok' : ''}
                {...register(name, { required: required ? `${label} is required` : false })} />
        </div>
    );
}

export default function IdentityVerificationStep({ register, errors, watch, setValue }) {
    return (
        <div className="flex flex-col gap-5 animate-fade-in-up">
            <div className="text-center">
                <span className="text-5xl">🪪</span>
                <h2 className="text-2xl font-black text-white mt-3">Verify Your Identity</h2>
                <p className="text-surface-400 mt-2 text-sm">
                    Required by Indian regulations for creator payouts. Documents are encrypted and reviewed securely.
                </p>
            </div>

            {/* Text fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                    { label: 'Full Legal Name', name: 'fullName', placeholder: 'As on PAN card', pattern: null },
                    { label: 'PAN Number', name: 'panNumber', placeholder: 'ABCDE1234F', pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
                    { label: 'Aadhaar Number', name: 'aadhaarNumber', placeholder: '1234 5678 9012', pattern: /^\d{12}$/ },
                    { label: 'Bank Account Number', name: 'bankAccountNumber', placeholder: 'Account number', pattern: null },
                    { label: 'IFSC Code', name: 'ifscCode', placeholder: 'SBIN0001234', pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
                ].map(({ label, name, placeholder, pattern }) => (
                    <div key={name} className={name === 'fullName' ? 'sm:col-span-2' : ''}>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">
                            {label} <span className="text-brand-500">*</span>
                        </label>
                        <input
                            className="input-dark"
                            placeholder={placeholder}
                            {...register(name, {
                                required: `${label} is required`,
                                ...(pattern && { pattern: { value: pattern, message: `Invalid ${label} format` } }),
                            })}
                        />
                        {errors[name] && <p className="mt-1 text-xs text-red-400">{errors[name].message}</p>}
                    </div>
                ))}
            </div>

            {/* File uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FileField label="Aadhaar Image" name="aadhaarImage" required register={register} setValue={setValue} watch={watch} />
                <FileField label="PAN Image" name="panImage" required register={register} setValue={setValue} watch={watch} />
                <FileField label="Bank Proof" name="bankProofImage" required register={register} setValue={setValue} watch={watch} />
            </div>

            {(errors.aadhaarImage || errors.panImage || errors.bankProofImage) && (
                <p className="text-red-400 text-xs">All three documents are required.</p>
            )}

            <div className="glass rounded-xl px-4 py-3 border border-white/5 text-xs text-surface-500 leading-relaxed">
                🔒 Your documents are encrypted and stored securely. They are only reviewed by our compliance team and are never shared publicly.
            </div>
        </div>
    );
}
