import { Link } from 'react-router-dom';

export default function CookiePolicy() {
    return (
        <div className="min-h-screen bg-[#030208] text-white py-20 px-6">
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="text-sm text-white/40 hover:text-white transition-colors mb-8 inline-block">← Back to home</Link>
                <h1 className="text-4xl font-black mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Cookie Policy</h1>
                <p className="text-white/40 text-sm mb-10">Last updated: March 2025</p>

                {[
                    {
                        title: 'What Are Cookies?',
                        body: `Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work, improve efficiency, and provide information to site owners.`
                    },
                    {
                        title: 'How We Use Cookies',
                        body: `Fannex uses cookies for the following purposes: Authentication (to keep you logged in), Security (to protect against fraudulent activity), Preferences (to remember your settings), Analytics (to understand how users interact with our platform using aggregated, anonymised data).`
                    },
                    {
                        title: 'Types of Cookies We Use',
                        body: `Essential Cookies: Required for the Platform to function correctly. These cannot be disabled. Preference Cookies: Remember your settings and preferences. Analytics Cookies: Help us understand usage patterns to improve the Platform. These collect data in aggregate form only.`
                    },
                    {
                        title: 'Managing Cookies',
                        body: `Most web browsers allow you to control cookies through your browser settings. You can choose to block or delete cookies. However, if you block essential cookies, some parts of the Platform may not function correctly.`
                    },
                    {
                        title: 'Contact',
                        body: `If you have questions about our use of cookies, please contact us at support@fannex.in.`
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
