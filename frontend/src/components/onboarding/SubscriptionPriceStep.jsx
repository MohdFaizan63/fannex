import { useState } from 'react';

const PRESETS = [1, 49, 199, 499, 999];

export default function SubscriptionPriceStep({ register, errors, watch, setValue }) {
    const price = watch('subscriptionPrice');
    const [custom, setCustom] = useState(false);

    const pick = (p) => {
        setCustom(false);
        setValue('subscriptionPrice', p, { shouldValidate: true });
    };

    const pickCustom = () => {
        setCustom(true);
        setValue('subscriptionPrice', '', { shouldValidate: false });
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
                <span className="text-5xl">💰</span>
                <h2 className="text-2xl font-black text-white mt-3">Monthly Subscription Price</h2>
                <p className="text-surface-400 mt-2 text-sm">
                    Set how much fans pay each month to access your exclusive content. You keep 80%.
                </p>
            </div>

            {/* Preset cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESETS.map(p => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => pick(p)}
                        className={`rounded-xl py-4 flex flex-col items-center gap-1 border-2 transition-all duration-200 ${!custom && price === p
                            ? 'border-brand-500 bg-brand-500/10 shadow-[0_0_16px_rgba(204,82,184,.2)]'
                            : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
                            }`}
                    >
                        <span className="text-xs text-surface-500 font-medium">₹</span>
                        <span className={`text-2xl font-black ${!custom && price === p ? 'text-brand-300' : 'text-white'}`}>{p}</span>
                        <span className="text-[10px] text-surface-500">/month</span>
                    </button>
                ))}
            </div>

            {/* Custom option */}
            <button
                type="button"
                onClick={pickCustom}
                className={`w-full rounded-xl py-3 border-2 text-sm font-semibold transition-all duration-200 ${custom
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-surface-500'
                    }`}
            >
                ✏️ Custom amount
            </button>

            {/* Custom input */}
            {custom && (
                <div className="animate-fade-in-up">
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">
                        Enter your price (₹)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-bold">₹</span>
                        <input
                            type="number"
                            className="input-dark pl-8"
                            placeholder="e.g. 299"
                            {...register('subscriptionPrice', {
                                required: 'Price is required',
                                min: { value: 0.1, message: 'Minimum price is ₹0.1' },
                                max: { value: 9999, message: 'Maximum price is ₹9999' },
                                valueAsNumber: true,
                            })}
                        />
                    </div>
                </div>
            )}

            {!custom && (
                <input type="hidden" {...register('subscriptionPrice', { required: 'Please select a price' })} />
            )}

            {errors.subscriptionPrice && (
                <p className="text-red-400 text-sm">{errors.subscriptionPrice.message}</p>
            )}

            {price && (
                <div className="glass border border-brand-500/20 rounded-xl px-4 py-3 text-center">
                    <p className="text-surface-400 text-xs mb-1">Your earnings per subscriber</p>
                    <p className="text-2xl font-black text-brand-400">
                        ₹{Math.floor((price ?? 0) * 0.8)}
                        <span className="text-sm font-normal text-surface-500">/month</span>
                    </p>
                    <p className="text-xs text-surface-600 mt-0.5">80% after 20% platform fee</p>
                </div>
            )}
        </div>
    );
}
