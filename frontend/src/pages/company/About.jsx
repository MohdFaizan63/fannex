import { Link } from 'react-router-dom';

export default function About() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>

                <h1 className="text-4xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                    About <span style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Fannex</span>
                </h1>

                <p className="text-white/60 text-lg leading-relaxed mb-8">
                    Fannex is India's creator subscription platform — built to help creators turn their passion into a sustainable income, and help fans support the creators they love.
                </p>

                <div className="grid gap-6 mb-14">
                    {[
                        { icon: '🎯', title: 'Our Mission', desc: 'To democratise the creator economy in India by giving every creator — no matter their niche — the tools to earn independently from their content and community.' },
                        { icon: '💡', title: 'What We Believe', desc: 'Creators deserve to own their audience relationship and earn fair revenue. Fans deserve direct access to the creators they love. We\'re building the infrastructure for both.' },
                        { icon: '🚀', title: 'Where We\'re Going', desc: 'We\'re growing fast. We\'re building new tools for creators to monetise their content — from subscriptions to paid messages, live events, and more.' },
                    ].map(({ icon, title, desc }) => (
                        <div key={title} className="flex gap-5 p-6 rounded-2xl border border-white/[0.06]"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <span className="text-2xl">{icon}</span>
                            <div>
                                <h3 className="font-bold text-white mb-2">{title}</h3>
                                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <p className="text-white/30 text-sm mb-6">Want to get in touch?</p>
                    <a href="mailto:support@fannex.in"
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                        support@fannex.in
                    </a>
                </div>
            </div>
        </div>
    );
}
