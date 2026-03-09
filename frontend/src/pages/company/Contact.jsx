import { Link } from 'react-router-dom';

export default function Contact() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-2xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>
                <h1 className="text-4xl font-black mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Contact Us</h1>
                <p className="text-white/50 mb-12 leading-relaxed">
                    Have a question or need help? We're here for you. Reach out through any of the channels below and we'll get back to you as soon as possible.
                </p>

                <div className="grid gap-5">
                    {[
                        {
                            icon: '📧',
                            title: 'General Support',
                            desc: 'Questions about your account, subscriptions, or the platform.',
                            contact: 'support@fannex.in',
                            href: 'mailto:support@fannex.in',
                        },
                        {
                            icon: '🎨',
                            title: 'Creator Support',
                            desc: 'Help with your creator account, payouts, or content.',
                            contact: 'support@fannex.in',
                            href: 'mailto:support@fannex.in?subject=Creator Support',
                        },
                        {
                            icon: '⚖️',
                            title: 'Legal & Compliance',
                            desc: 'DMCA notices, legal requests, or privacy concerns.',
                            contact: 'support@fannex.in',
                            href: 'mailto:support@fannex.in?subject=Legal Inquiry',
                        },
                    ].map(({ icon, title, desc, contact, href }) => (
                        <a key={title} href={href}
                            className="flex items-start gap-5 p-6 rounded-2xl border border-white/[0.06] hover:border-white/20 transition-all duration-300 group"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <span className="text-2xl mt-0.5">{icon}</span>
                            <div className="flex-1">
                                <h3 className="font-bold text-white mb-1">{title}</h3>
                                <p className="text-white/50 text-sm mb-3">{desc}</p>
                                <span className="text-sm font-medium group-hover:text-white transition-colors"
                                    style={{ color: '#a855f7' }}>{contact}</span>
                            </div>
                            <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 mt-1 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    ))}
                </div>

                <p className="text-white/30 text-sm mt-10 text-center">
                    We typically respond within 24–48 hours on business days.
                </p>
            </div>
        </div>
    );
}
