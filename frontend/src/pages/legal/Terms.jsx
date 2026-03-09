import { Link } from 'react-router-dom';

export default function Terms() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>
                <h1 className="text-4xl font-black mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Terms of Service</h1>
                <p className="text-white/40 text-sm mb-10">Last updated: March 2025</p>

                {[
                    {
                        title: '1. Acceptance of Terms',
                        body: `By accessing and using Fannex ("the Platform"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform. We reserve the right to update these terms at any time, and your continued use of the Platform constitutes acceptance of any changes.`
                    },
                    {
                        title: '2. User Accounts',
                        body: `You must be at least 18 years old to create an account on Fannex. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately at support@fannex.in of any unauthorised use of your account.`
                    },
                    {
                        title: '3. Creator Content',
                        body: `Creators are solely responsible for the content they upload and share on the Platform. Content must not violate any applicable laws, infringe third-party rights, or violate our Community Guidelines. Fannex reserves the right to remove content and terminate accounts that violate these terms without prior notice.`
                    },
                    {
                        title: '4. Subscriptions & Payments',
                        body: `Subscriptions are billed on a recurring basis as specified at the time of purchase. You may cancel your subscription at any time; however, we do not provide refunds for partial subscription periods. All payments are processed securely by our payment partners. Fannex takes a platform fee on creator earnings as disclosed on our pricing page.`
                    },
                    {
                        title: '5. Prohibited Conduct',
                        body: `You agree not to: use the Platform for any unlawful purpose; upload content that is harmful, abusive, or offensive; attempt to gain unauthorised access to any part of the Platform; use automated tools to scrape or crawl the Platform; or impersonate any person or entity.`
                    },
                    {
                        title: '6. Intellectual Property',
                        body: `The Fannex name, logo, and all related marks are trademarks of Fannex. Creators retain ownership of the content they upload. By uploading content to Fannex, you grant us a non-exclusive, worldwide, royalty-free licence to display and deliver the content to subscribers.`
                    },
                    {
                        title: '7. Limitation of Liability',
                        body: `To the maximum extent permitted by law, Fannex shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Platform.`
                    },
                    {
                        title: '8. Contact',
                        body: `For questions about these Terms, please contact us at support@fannex.in.`
                    },
                ].map(({ title, body }) => (
                    <section key={title} className="mb-8">
                        <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
                        <p className="text-white/60 leading-relaxed text-sm">{body}</p>
                    </section>
                ))}
            </div>
        </div>
    );
}
