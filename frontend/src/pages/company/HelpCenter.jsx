import { Link } from 'react-router-dom';

export default function HelpCenter() {
    const FAQS = [
        {
            q: 'How do I subscribe to a creator?',
            a: 'Visit any creator\'s profile page and click the "Join now" button. Choose your subscription plan and complete payment. You\'ll get instant access to their exclusive content.',
        },
        {
            q: 'How do I cancel my subscription?',
            a: 'Go to your Subscriptions page from the Navbar, find the creator\'s subscription card, and click "Cancel". Your access continues until the end of the current billing period.',
        },
        {
            q: 'When do creators receive their payouts?',
            a: 'Creators can request payouts anytime from the Earnings page on their dashboard. Payouts are typically processed within 3–5 business days.',
        },
        {
            q: 'How do I become a creator on Fannex?',
            a: 'Click "Become a Creator" from your account menu or the home page. Complete the verification form with your details. Our team reviews applications within 2–5 business days.',
        },
        {
            q: 'What percentage does Fannex take?',
            a: 'Fannex takes a platform fee from creator earnings. Detailed pricing information is available on our Pricing page. Creators keep the majority of their subscription revenue.',
        },
        {
            q: 'My payment failed — what do I do?',
            a: 'Check that your payment details are correct and your card has sufficient funds. If the issue persists, try a different payment method or contact your bank. You can also reach us at support@fannex.in.',
        },
        {
            q: 'How do I report a creator or content?',
            a: 'Use the report button on any post or profile page. For urgent concerns, email support@fannex.in with details and we\'ll investigate promptly.',
        },
        {
            q: 'Is my payment information secure?',
            a: 'Yes. We never store your full card details. All payments are processed by certified payment gateways that are PCI-DSS compliant.',
        },
    ];

    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>
                <h1 className="text-4xl font-black mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Help Center</h1>
                <p className="text-white/50 mb-12">Frequently asked questions. Can't find your answer?{' '}
                    <a href="mailto:support@fannex.in" className="text-purple-400 hover:text-purple-300 transition-colors">Email us.</a>
                </p>

                <div className="flex flex-col gap-3">
                    {FAQS.map(({ q, a }) => (
                        <details key={q}
                            className="group rounded-xl border border-white/[0.06] overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <summary className="flex items-center justify-between p-5 cursor-pointer select-none list-none font-semibold text-sm text-white/90 hover:text-white transition-colors">
                                {q}
                                <svg className="w-4 h-4 text-white/30 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <p className="px-5 pb-5 text-white/50 text-sm leading-relaxed">{a}</p>
                        </details>
                    ))}
                </div>

                <div className="mt-14 p-6 rounded-2xl border border-purple-500/20 text-center"
                    style={{ background: 'rgba(168,85,247,0.05)' }}>
                    <p className="text-white/70 mb-3">Still need help?</p>
                    <a href="mailto:support@fannex.in"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                        📧 Contact Support
                    </a>
                </div>
            </div>
        </div>
    );
}
