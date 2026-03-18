import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * /payment-failed
 * Shown when:
 *   • User cancels on Cashfree's payment page (cancel_url)
 *   • Payment verification fails on /subscription-success
 *
 * Back-button is intercepted so the user cannot navigate back to the
 * Cashfree payment page; instead they are sent to /.
 *
 * "Try Again" reads the subscribe-page URL saved by SubscribePage in
 * sessionStorage BEFORE opening Cashfree, so it navigates the user back
 * correctly regardless of how many history guard entries have been pushed.
 */
export default function PaymentFailed() {
    const navigate = useNavigate();

    // 5-entry guard — same rationale as SubscriptionSuccess
    useEffect(() => {
        const cleanPath = window.location.pathname;
        for (let i = 0; i < 5; i++) {
            window.history.pushState({ paymentGuard: true, i }, '', cleanPath);
        }
        // Use navigate so React Router state stays in sync
        const handleBack = () => { navigate('/', { replace: true }); };
        window.addEventListener('popstate', handleBack);
        return () => window.removeEventListener('popstate', handleBack);
    }, [navigate]);

    // SubscribePage stores this key before calling cashfree.checkout()
    const handleTryAgain = () => {
        const returnUrl = sessionStorage.getItem('fannex_subscribe_return');
        sessionStorage.removeItem('fannex_subscribe_return');
        navigate(returnUrl || '/explore', { replace: true });
    };

    return (
        <div style={pageStyle}>
            {/* Background orb */}
            <div style={{
                position: 'fixed', inset: 0, overflow: 'hidden',
                pointerEvents: 'none', zIndex: 0,
            }}>
                <div style={{
                    position: 'absolute', top: '30%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400, height: 400, borderRadius: '50%', opacity: 0.12,
                    background: 'radial-gradient(circle, #ef4444, transparent 65%)',
                }} />
                <div style={{
                    position: 'absolute', bottom: '20%', right: '15%',
                    width: 260, height: 260, borderRadius: '50%', opacity: 0.07,
                    background: 'radial-gradient(circle, #f97316, transparent 65%)',
                }} />
            </div>

            {/* Card */}
            <div style={cardStyle}>
                {/* Icon */}
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                    border: '2px solid rgba(239,68,68,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, margin: '0 auto 20px',
                    boxShadow: '0 8px 28px rgba(239,68,68,0.2)',
                }}>
                    ✕
                </div>

                <h1 style={headingStyle}>Payment Not Completed</h1>
                <p style={subtitleStyle}>
                    Your payment was cancelled or could not be processed.<br />
                    <strong style={{ color: 'rgba(255,255,255,0.6)' }}>You have not been charged.</strong>
                </p>

                {/* Help note */}
                <div style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 12, padding: '12px 16px',
                    marginBottom: 24,
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                        If you were charged but the payment failed, it will be automatically refunded within 5–7 business days.
                        For help, email <a href="mailto:support@fannex.in" style={{ color: '#a78bfa' }}>support@fannex.in</a>
                    </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        onClick={handleTryAgain}
                        style={btnPrimary}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(124,58,237,0.55)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.4)'; }}
                    >
                        ↩ Try Again
                    </button>

                    <Link to="/explore" style={btnSecondary}>
                        Explore Creators
                    </Link>

                    <Link to="/" style={btnGhost}>
                        Go to Home
                    </Link>
                </div>
            </div>

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const pageStyle = {
    minHeight: '100dvh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#050208',
    fontFamily: "'Inter', sans-serif",
    position: 'relative', overflow: 'hidden',
    padding: '24px 16px',
};

const cardStyle = {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 400,
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid rgba(239,68,68,0.12)',
    borderRadius: 28,
    padding: '36px 28px 28px',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    animation: 'fadeUp 0.45s ease both',
};

const headingStyle = {
    color: '#fff', fontWeight: 900,
    fontSize: 22, margin: '0 0 10px',
    letterSpacing: '-0.3px',
};

const subtitleStyle = {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14, margin: '0 0 20px',
    lineHeight: 1.6,
};

const btnPrimary = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    boxShadow: '0 8px 28px rgba(124,58,237,0.4)',
    color: '#fff', fontWeight: 800, fontSize: 15,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const btnSecondary = {
    display: 'block', padding: '13px 0', borderRadius: 16,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
};

const btnGhost = {
    display: 'block', padding: '11px 0', borderRadius: 14,
    color: 'rgba(255,255,255,0.3)', fontSize: 14,
    textDecoration: 'none',
    transition: 'color 0.15s ease',
};
