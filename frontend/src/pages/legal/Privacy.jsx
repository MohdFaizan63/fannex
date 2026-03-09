import { Link } from 'react-router-dom';

export default function Privacy() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>
                <h1 className="text-4xl font-black mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Privacy Policy</h1>
                <p className="text-white/40 text-sm mb-10">Last updated: March 2025</p>

                {[
                    {
                        title: '1. Information We Collect',
                        body: `We collect information you provide directly to us when you create an account, subscribe to creators, or contact us for support. This includes your name, email address, payment information (processed securely by our payment partners), and profile details. We also collect usage data such as pages visited, features used, and interactions with content on the platform.`
                    },
                    {
                        title: '2. How We Use Your Information',
                        body: `We use your information to provide, maintain, and improve the Fannex platform; process transactions and send related information; send promotional communications (with your consent); respond to your comments and questions; and monitor and analyse trends, usage, and activities in connection with our platform.`
                    },
                    {
                        title: '3. Sharing of Information',
                        body: `We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information with our business partners. We may share your information with third-party service providers who assist us in operating the platform, conducting our business, or serving users.`
                    },
                    {
                        title: '4. Data Security',
                        body: `We implement appropriate technical and organisational security measures designed to protect your personal information against accidental or unlawful destruction, loss, alteration, unauthorised disclosure, or access. However, no method of transmission over the Internet or electronic storage is 100% secure.`
                    },
                    {
                        title: '5. Cookies',
                        body: `We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. Please refer to our Cookie Policy for more information.`
                    },
                    {
                        title: '6. Your Rights',
                        body: `You have the right to access, update, or delete the information we have on you. You may also object to processing, request restriction of processing, and request portability of your data. To exercise these rights, please contact us at support@fannex.in.`
                    },
                    {
                        title: '7. Contact Us',
                        body: `If you have any questions about this Privacy Policy, please contact us at support@fannex.in.`
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
