const TYPES = [
    {
        id: 'human',
        icon: '🎭',
        title: 'Human Creator',
        desc: 'Real person creating authentic content — art, music, videos, writing & more.',
        badge: 'Most Popular',
    },
    {
        id: 'ai',
        icon: '🤖',
        title: 'AI Creator',
        desc: 'AI-generated content, virtual characters, or AI-assisted creative work.',
        badge: 'Trending',
    },
];

export default function CreatorTypeStep({ register, errors, watch, setValue }) {
    const selected = watch('creatorType');

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">
            <div className="text-center">
                <span className="text-5xl">🎨</span>
                <h2 className="text-2xl font-black text-white mt-3">Select Your Creator Type</h2>
                <p className="text-surface-400 mt-2 text-sm">
                    We'll tailor your onboarding experience based on your creator type.
                </p>
            </div>

            <input type="hidden" {...register('creatorType', { required: 'Please select a creator type' })} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TYPES.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setValue('creatorType', t.id, { shouldValidate: true })}
                        className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${selected === t.id
                                ? 'border-brand-500 bg-brand-500/10 shadow-[0_0_20px_rgba(204,82,184,.2)]'
                                : 'border-surface-700 bg-surface-800/60 hover:border-surface-500 hover:bg-surface-700/60'
                            }`}
                    >
                        {/* Badge */}
                        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                            {t.badge}
                        </span>

                        <div className="text-4xl mb-3">{t.icon}</div>
                        <h3 className={`font-bold text-base mb-1 ${selected === t.id ? 'text-brand-300' : 'text-white'}`}>
                            {t.title}
                        </h3>
                        <p className="text-surface-400 text-xs leading-relaxed">{t.desc}</p>

                        {selected === t.id && (
                            <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs">
                                ✓
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {errors.creatorType && (
                <p className="text-red-400 text-sm text-center">{errors.creatorType.message}</p>
            )}
        </div>
    );
}
