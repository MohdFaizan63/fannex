const STEPS = [
    { label: 'Country', icon: '🌍' },
    { label: 'Type', icon: '🎨' },
    { label: 'Profile', icon: '👤' },
    { label: 'Pricing', icon: '💰' },
    { label: 'KYC', icon: '🪪' },
    { label: 'Done', icon: '🎉' },
];

export default function StepProgress({ current }) {
    const pct = (current / (STEPS.length - 1)) * 100;
    return (
        <div style={{ marginBottom: '16px' }}>
            {/* Segmented progress bar */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {STEPS.map((_, i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: '3px',
                            borderRadius: '2px',
                            background: i < current
                                ? 'linear-gradient(90deg, #7c3aed, #cc52b8)'
                                : i === current
                                    ? 'linear-gradient(90deg, #a855f7, rgba(168,85,247,0.3))'
                                    : 'rgba(255,255,255,0.07)',
                            transition: 'background 0.4s ease',
                        }}
                    />
                ))}
            </div>

            {/* Step label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {STEPS[current]?.icon} &nbsp;{STEPS[current]?.label}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                    {current + 1} of {STEPS.length}
                </p>
            </div>
        </div>
    );
}
