/**
 * Wallet.jsx — Minimal payment-return handler.
 *
 * This page only exists to handle the Cashfree return URL:
 *   /wallet?order_id=wallet_xxx
 *
 * There is NO wallet management UI here — all recharging happens
 * through the WalletRechargeModal inside Chat.
 *
 * Direct visits (no order_id) → redirect to /home.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const fmt = (n) => Number(n).toLocaleString('en-IN');

export default function Wallet() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const [successBanner, setSuccessBanner] = useState(null);
    const [verifying, setVerifying] = useState(false);

    const verifiedRef = useRef(false);

    useEffect(() => {
        if (verifiedRef.current) return;

        const orderId = searchParams.get('order_id');

        // No order_id — nothing to do here, redirect home
        if (!orderId || !orderId.startsWith('wallet_')) {
            navigate('/', { replace: true });
            return;
        }

        // Session token guard: prevent replay on refresh
        const verifiedKey = 'fannex_verified_orders';
        let alreadyVerified = [];
        try { alreadyVerified = JSON.parse(sessionStorage.getItem(verifiedKey) || '[]'); } catch { }
        if (alreadyVerified.includes(orderId)) {
            navigate('/', { replace: true });
            return;
        }
        sessionStorage.setItem(verifiedKey, JSON.stringify([...alreadyVerified, orderId]));

        verifiedRef.current = true;
        setVerifying(true);

        // Strip order_id from URL immediately
        navigate('/wallet', { replace: true });

        const stored = sessionStorage.getItem('fannex_wallet_recharge');
        let amount = null;
        let chatId = null;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                amount = parsed.amount;
                chatId = parsed.chatId || null;
            } catch { }
            sessionStorage.removeItem('fannex_wallet_recharge');
        }

        api.post('/payment/wallet-verify', { orderId, amount })
            .then(r => {
                const newBalance = r.data.data?.walletBalance ?? 0;
                setSuccessBanner({ amount, newBalance, chatId });
                refreshUser().catch(() => { });
            })
            .catch(() => {
                // Verify failed — just go home
                navigate('/', { replace: true });
            })
            .finally(() => setVerifying(false));

    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Loading ──────────────────────────────────────────────────────── */
    if (verifying) {
        return (
            <div style={pageStyle}>
                <div style={spinnerStyle} />
                <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, fontSize: 15 }}>
                    Verifying payment…
                </p>
                <style>{kf}</style>
            </div>
        );
    }

    /* ── Success ──────────────────────────────────────────────────────── */
    if (successBanner) {
        return (
            <div style={pageStyle}>
                {/* Background glow */}
                <div style={{
                    position: 'absolute', top: '30%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 320, height: 320, borderRadius: '50%', opacity: 0.12,
                    background: 'radial-gradient(circle, #7c3aed, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{
                        width: '100%', maxWidth: 360,
                        textAlign: 'center', position: 'relative', zIndex: 1,
                        padding: '0 20px',
                    }}
                >
                    {/* Animated check */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 300 }}
                        style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            boxShadow: '0 12px 40px rgba(124,58,237,0.45)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 24px',
                        }}
                    >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                            <motion.path
                                d="M5 13l4 4L19 7"
                                stroke="#fff"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
                            />
                        </svg>
                    </motion.div>

                    <h1 style={{
                        color: '#fff', fontWeight: 900,
                        fontSize: 'clamp(20px, 5vw, 26px)',
                        margin: '0 0 10px', letterSpacing: '-0.4px', lineHeight: 1.2,
                    }}>
                        {successBanner.amount
                            ? `₹${fmt(successBanner.amount)} Added to Wallet!`
                            : 'Wallet Recharged! 🎉'}
                    </h1>

                    <p style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 15, margin: '0 0 32px', lineHeight: 1.6,
                    }}>
                        Your wallet has been topped up successfully.
                    </p>

                    <button
                        onClick={() => {
                            if (successBanner.chatId) {
                                navigate(`/chat/${successBanner.chatId}`, { replace: true });
                            } else {
                                navigate('/', { replace: true });
                            }
                        }}
                        style={{
                            width: '100%', height: 52, borderRadius: 16, border: 'none',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            color: '#fff', fontWeight: 800, fontSize: 16,
                            fontFamily: 'inherit', cursor: 'pointer',
                            boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                        <span style={{ fontSize: 18 }}>
                            {successBanner.chatId ? '💬' : '🏠'}
                        </span>
                        {successBanner.chatId ? 'Go back to Chat' : 'Go to Home'}
                    </button>
                </motion.div>
                <style>{kf}</style>
            </div>
        );
    }

    // Fallback while redirecting
    return null;
}

const pageStyle = {
    minHeight: '100dvh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#050208',
    fontFamily: "'Inter', sans-serif",
    position: 'relative', overflow: 'hidden',
};

const spinnerStyle = {
    width: 44, height: 44, borderRadius: '50%',
    border: '2.5px solid rgba(168,85,247,0.2)',
    borderTopColor: '#a855f7',
    animation: 'spin 0.8s linear infinite',
};

const kf = `@keyframes spin { to { transform: rotate(360deg); } }`;
