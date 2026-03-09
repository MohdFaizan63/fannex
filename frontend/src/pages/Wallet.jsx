/**
 * Wallet.jsx — Minimal payment-return handler with back-button protection.
 *
 * Only exists to handle Cashfree return URL: /wallet?order_id=wallet_xxx
 *
 * Back-button protection strategy:
 *   When success screen shows, we push a dummy history entry so that pressing
 *   back triggers our popstate handler instead of showing the Cashfree page.
 *   The handler then uses window.location.replace() to send the user to
 *   chat — skipping Cashfree completely.
 *
 * Direct visits (no order_id) → redirect to home.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const fmt = (n) => Math.round(Number(n)).toLocaleString('en-IN');

export default function Wallet() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const [successBanner, setSuccessBanner] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const verifiedRef = useRef(false);

    /* ── Payment verification on mount ─────────────────────────────────── */
    useEffect(() => {
        if (verifiedRef.current) return;

        const orderId = searchParams.get('order_id');

        // No order_id — nothing to do here, redirect home
        if (!orderId || !orderId.startsWith('wallet_')) {
            navigate('/', { replace: true });
            return;
        }

        // ── One-time session token guard ─────────────────────────────────
        // Prevents re-running on browser refresh or back+forward replay
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

        // Strip order_id from URL right away  
        navigate('/wallet', { replace: true });

        // Read chat context stored before redirect
        const stored = sessionStorage.getItem('fannex_wallet_recharge');
        let amount = null;
        let chatId = null;
        if (stored) {
            try {
                const p = JSON.parse(stored);
                amount = p.amount;
                chatId = p.chatId || null;
            } catch { }
            sessionStorage.removeItem('fannex_wallet_recharge');
        }

        api.post('/payment/wallet-verify', { orderId, amount })
            .then(r => {
                const newBalance = r.data.data?.walletBalance ?? 0;
                setSuccessBanner({ amount, newBalance, chatId });
                refreshUser().catch(() => { });
            })
            .catch(() => navigate('/', { replace: true }))
            .finally(() => setVerifying(false));

    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Back-button trap ───────────────────────────────────────────────
     *
     * Problem: History after payment return looks like:
     *   [...chat_page, cashfree_page, /wallet (current)]
     *
     * When we navigate to /chat with replace:true:
     *   [...chat_page, cashfree_page, /chat]
     *
     * Pressing back → cashfree_page (bad).
     *
     * Fix: Push a dummy state onto history so it becomes:
     *   [...chat_page, cashfree_page, /wallet, DUMMY]
     *
     * User presses back → pops DUMMY → fires popstate → we intercept
     * and use window.location.replace('/chat/xxx') which replaces DUMMY.
     * New history: [...chat_page, cashfree_page, /chat]
     *
     * If user presses back again from /chat → cashfree_page.
     * But /wallet?order_id is already verified+stripped so re-visiting
     * cashfree redirect lands on /wallet → session guard → redirects home.
     * ──────────────────────────────────────────────────────────────────── */
    const chatIdRef = useRef(null); // ref so closure is never stale
    useEffect(() => {
        if (!successBanner) return;
        chatIdRef.current = successBanner.chatId;

        // Push dummy entry so back-press lands HERE first (not on Cashfree)
        window.history.pushState({ walletSuccessTrap: true }, '');

        const handlePopState = (e) => {
            // CAPTURE PHASE — we run before React Router's bubble-phase listener
            // stopImmediatePropagation prevents React Router from also handling this
            e.stopImmediatePropagation();

            const dest = chatIdRef.current ? `/chat/${chatIdRef.current}` : '/';
            // location.replace removes this entry from history — Cashfree is skipped
            window.location.replace(dest);
        };

        // capture: true → fires in capture phase, before React Router
        window.addEventListener('popstate', handlePopState, { capture: true });
        return () => window.removeEventListener('popstate', handlePopState, { capture: true });
    }, [successBanner]);

    /* ── Navigate away from success ─────────────────────────────────────
     * Using window.location.replace ensures the success URL is fully
     * removed from the browser's forward/back stack.
     * ─────────────────────────────────────────────────────────────────── */
    const handleLeave = () => {
        const dest = successBanner?.chatId
            ? `/chat/${successBanner.chatId}`
            : '/';
        window.location.replace(dest);
    };

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
                    {/* Animated checkmark */}
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
                        onClick={handleLeave}
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
