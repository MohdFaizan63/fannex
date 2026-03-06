import { useState } from 'react';

const COUNTRIES = [
    'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'Netherlands', 'Singapore', 'UAE',
    'Japan', 'South Korea', 'Brazil', 'Mexico', 'Indonesia',
    'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Malaysia',
    'Philippines', 'Thailand', 'Vietnam', 'Nigeria', 'Kenya',
    'South Africa', 'Egypt', 'Saudi Arabia', 'Turkey', 'Italy',
    'Spain', 'New Zealand', 'Sweden', 'Norway', 'Denmark',
    'Finland', 'Switzerland', 'Austria', 'Belgium', 'Poland',
];

export default function CountryStep({ register, errors, watch, setValue }) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const selected = watch('countryOfResidency');

    const filtered = COUNTRIES.filter(c =>
        c.toLowerCase().includes(search.toLowerCase())
    );

    const pick = (country) => {
        setValue('countryOfResidency', country, { shouldValidate: true });
        setOpen(false);
        setSearch('');
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
                <span className="text-5xl">🌍</span>
                <h2 className="text-2xl font-black text-white mt-3">Country of Residency</h2>
                <p className="text-surface-400 mt-2 text-sm">
                    We use this to determine available payment methods and tax requirements.
                </p>
            </div>

            {/* Hidden validation field */}
            <input type="hidden" {...register('countryOfResidency', { required: 'Please select your country' })} />

            <div className="relative">
                {/* Trigger */}
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className={`w-full input-dark flex items-center justify-between text-left ${selected ? 'text-white' : 'text-surface-500'
                        }`}
                >
                    <span>{selected || 'Select your country…'}</span>
                    <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {/* Dropdown */}
                {open && (
                    <div className="absolute z-50 w-full mt-2 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="p-2 border-b border-white/10">
                            <input
                                autoFocus
                                className="input-dark text-sm py-2"
                                placeholder="Search countries…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <ul className="max-h-52 overflow-y-auto">
                            {filtered.length === 0
                                ? <li className="px-4 py-3 text-sm text-surface-500">No results</li>
                                : filtered.map(c => (
                                    <li key={c}>
                                        <button
                                            type="button"
                                            onClick={() => pick(c)}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${selected === c ? 'text-brand-400 font-semibold' : 'text-surface-200'
                                                }`}
                                        >
                                            {c}
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    </div>
                )}
            </div>

            {errors.countryOfResidency && (
                <p className="text-red-400 text-sm">{errors.countryOfResidency.message}</p>
            )}

            {selected && (
                <div className="glass border border-brand-500/20 rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in-up">
                    <span className="text-2xl">✅</span>
                    <div>
                        <p className="text-white font-semibold text-sm">Selected</p>
                        <p className="text-brand-400 text-sm">{selected}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
