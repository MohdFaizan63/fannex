import { Link } from 'react-router-dom';

export default function Pricing() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>

                <div className="text-center mb-14">
                    <h1 className="text-4xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Simple, Transparent{' '}
                        <span style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pricing</span>
                    </h1>
                    <p className="text-white/50 max-w-lg mx-auto">
                        No hidden fees. Creators keep the majority of what they earn. Fans pay only what creators charge.
                    </p>
                </div>

                {/* Creator pricing */}
                <div className="grid md:grid-cols-2 gap-6 mb-14">
                    <div className="p-8 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <h2 className="text-xl font-black mb-2">For Creators</h2>
                        <p className="text-white/40 text-sm mb-6">Free to join. We earn when you earn.</p>
                        <div className="text-5xl font-black mb-1" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>0%</div>
                        <p className="text-white/40 text-sm mb-8">to get started</p>
                        <ul className="flex flex-col gap-3 text-sm text-white/70">
                            {['Free account creation', 'Set your own subscription price', 'Unlimited posts & content', 'Built-in analytics dashboard', 'Direct fan messaging', 'Payouts within 3–5 business days'].map(f => (
                                <li key={f} className="flex items-center gap-2">
                                    <span className="text-green-400 text-base">✓</span> {f}
                                </li>
                            ))}
                        </ul>
                        <p className="text-white/30 text-xs mt-6 leading-relaxed">
                            A small platform fee applies on each successful subscription payment. The exact percentage is shown during onboarding.
                        </p>
                    </div>

                    <div className="p-8 rounded-2xl border border-purple-500/30" style={{ background: 'rgba(168,85,247,0.06)' }}>
                        <h2 className="text-xl font-black mb-2">For Fans</h2>
                        <p className="text-white/40 text-sm mb-6">Pay only what creators charge.</p>
                        <div className="text-5xl font-black mb-1" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹10+</div>
                        <p className="text-white/40 text-sm mb-8">per creator / month (set by creator)</p>
                        <ul className="flex flex-col gap-3 text-sm text-white/70">
                            {['Access exclusive content', 'Direct messaging with creators', 'Cancel anytime, no penalties', 'Secure payments', 'Instant access after payment', 'Support your favourite creators'].map(f => (
                                <li key={f} className="flex items-center gap-2">
                                    <span className="text-purple-400 text-base">✓</span> {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-white/30 text-sm mb-4">Still have questions about pricing?</p>
                    <a href="mailto:support@fannex.in" className="text-purple-400 hover:text-purple-300 transition-colors text-sm">support@fannex.in</a>
                </div>
            </div>
        </div>
    );
}
