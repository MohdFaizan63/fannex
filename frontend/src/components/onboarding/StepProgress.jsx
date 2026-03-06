const STEPS = [
    { label: 'Country', icon: '🌍' },
    { label: 'Creator Type', icon: '🎨' },
    { label: 'Profile', icon: '👤' },
    { label: 'Pricing', icon: '💰' },
    { label: 'Verification', icon: '🪪' },
    { label: 'Done', icon: '🎉' },
];

export default function StepProgress({ current }) {
    return (
        <div className="px-2 mb-8">
            {/* Progress bar track */}
            <div className="flex items-center justify-between relative">
                {/* background line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-surface-700 z-0" />
                {/* filled line */}
                <div
                    className="absolute top-4 left-0 h-0.5 bg-gradient-to-r from-brand-500 to-violet-500 z-10 transition-all duration-500"
                    style={{ width: `${(current / (STEPS.length - 1)) * 100}%` }}
                />

                {STEPS.map((step, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                        <div key={step.label} className="flex flex-col items-center gap-1.5 z-20 relative">
                            {/* Circle */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${done ? 'bg-brand-500 text-white shadow-[0_0_12px_rgba(204,82,184,.5)]' :
                                    active ? 'bg-surface-800 border-2 border-brand-500 text-brand-400 shadow-[0_0_12px_rgba(204,82,184,.3)]' :
                                        'bg-surface-800 border-2 border-surface-600 text-surface-500'
                                }`}>
                                {done ? '✓' : step.icon}
                            </div>
                            {/* Label — hide on very small screens */}
                            <span className={`hidden sm:block text-[10px] font-medium transition-colors ${active ? 'text-brand-400' : done ? 'text-surface-300' : 'text-surface-600'
                                }`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Step counter */}
            <p className="text-center text-xs text-surface-500 mt-3">
                Step {current + 1} of {STEPS.length}
            </p>
        </div>
    );
}
