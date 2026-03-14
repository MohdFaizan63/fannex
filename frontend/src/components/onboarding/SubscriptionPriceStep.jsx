import { useState, useRef } from 'react';

const PRESETS = [49, 99, 199, 499, 999];

export default function SubscriptionPriceStep({ register, errors, watch, setValue }) {
    const price = watch('subscriptionPrice');
    const [custom, setCustom] = useState(false);
    const customRef = useRef(null);

    const pick = (p) => {
        setCustom(false);
        setValue('subscriptionPrice', p, { shouldValidate: true });
    };

    const pickCustom = () => {
        setCustom(true);
        setValue('subscriptionPrice', '', { shouldValidate: false });
        setTimeout(() => customRef.current?.focus(), 50);
    };

    const earningsPreview = price && !isNaN(price) ? Math.floor(Number(price) * 0.8) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '8px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', paddingTop: '4px' }}>
                <div style={{
                    width: '50px', height: '50px', borderRadius: '15px', margin: '0 auto 10px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(52,211,153,0.15))',
                    border: '1px solid rgba(52,211,153,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                }}>💰</div>
                <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    Monthly Price
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '5px', fontSize: '13px' }}>
                    You keep <strong style={{ color: '#34d399' }}>80%</strong> of every subscription
                </p>
            </div>

            {/* Preset prices — 2 or 3 per row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {PRESETS.map(p => {
                    const active = !custom && price === p;
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => pick(p)}
                            style={{
                                borderRadius: '14px',
                                padding: '14px 8px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                border: active ? '2px solid #a855f7' : '1.5px solid rgba(255,255,255,0.08)',
                                background: active
                                    ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))'
                                    : 'rgba(255,255,255,0.03)',
                                boxShadow: active ? '0 0 20px rgba(124,58,237,0.25)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>₹</span>
                            <span style={{ fontSize: '22px', fontWeight: 900, color: active ? '#c084fc' : '#fff', lineHeight: 1 }}>{p}</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>/month</span>
                        </button>
                    );
                })}

                {/* Custom button */}
                <button
                    type="button"
                    onClick={pickCustom}
                    style={{
                        borderRadius: '14px',
                        padding: '14px 8px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        border: custom ? '2px solid #a855f7' : '1.5px dashed rgba(255,255,255,0.12)',
                        background: custom ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    <span style={{ fontSize: '18px' }}>✏️</span>
                    <span style={{ fontSize: '10px', color: custom ? '#c084fc' : 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Custom</span>
                </button>
            </div>

            {/* Custom input */}
            {custom && (
                <div style={{ animation: 'fadeUp 0.2s ease' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                            color: 'rgba(168,85,247,0.8)', fontWeight: 700, fontSize: '16px', zIndex: 1,
                        }}>₹</span>
                        <input
                            ref={customRef}
                            type="number"
                            inputMode="numeric"
                            enterKeyHint="done"
                            placeholder="Enter your price"
                            style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: '1.5px solid rgba(168,85,247,0.4)',
                                borderRadius: '14px', padding: '14px 16px 14px 32px',
                                color: '#fff', fontSize: '16px', outline: 'none', fontFamily: 'inherit',
                                boxShadow: '0 0 0 3px rgba(124,58,237,0.15)',
                                WebkitAppearance: 'none',
                            }}
                            {...register('subscriptionPrice', {
                                required: 'Price is required',
                                min: { value: 1, message: 'Minimum price is ₹1' },
                                max: { value: 9999, message: 'Maximum price is ₹9,999' },
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
                <p style={{ fontSize: '12px', color: '#f87171' }}>⚠ {errors.subscriptionPrice.message}</p>
            )}

            {/* Earnings preview */}
            {earningsPreview !== null && (
                <div style={{
                    borderRadius: '16px', padding: '14px 16px', textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.05))',
                    border: '1px solid rgba(52,211,153,0.2)',
                }}>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Your earnings per subscriber
                    </p>
                    <p style={{ fontSize: '26px', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>
                        ₹{earningsPreview}<span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>/month</span>
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>After 20% platform fee</p>
                </div>
            )}

            <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
}
