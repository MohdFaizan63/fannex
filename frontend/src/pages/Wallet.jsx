import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRESETS = [50, 100, 200, 500, 1000, 2000];

function fmt(n) {
    if (n == null) return '…';
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Wallet() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshUser } = useAuth();

    const [balance, setBalance] = useState(null);
    const [selected, setSelected] = useState(null);
    const [customAmt, setCustomAmt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingBal, setLoadingBal] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [loadingTx, setLoadingTx] = useState(true);

    // Success screen — shown after returning from Cashfree payment
    const [successBanner, setSuccessBanner] = useState(null); // { amount, newBalance, chatId }

    const finalAmount = selected ?? (customAmt ? Number(customAmt) : null);

    // ── Fetch balance + transactions ────────────────────────────────────────────
    const fetchBalance = useCallback(() => {
        setLoadingBal(true);
        return api.get('/payment/wallet-balance')
            .then(r => setBalance(r.data.data.walletBalance))
            .catch(() => setBalance(0))
            .finally(() => setLoadingBal(false));
    }, []);

    const fetchTransactions = useCallback(() => {
        setLoadingTx(true);
        return api.get('/payment/wallet-transactions')
            .then(r => setTransactions(r.data.data || []))
            .catch(() => setTransactions([]))
            .finally(() => setLoadingTx(false));
    }, []);

    useEffect(() => {
        fetchBalance();
        fetchTransactions();
    }, [fetchBalance, fetchTransactions]);

    // ── Detect return from Cashfree payment (order_id in URL) ──────────────────
    const verifiedRef = useRef(false);
    useEffect(() => {
        if (verifiedRef.current) return;
        const orderId = searchParams.get('order_id');
        if (!orderId || !orderId.startsWith('wallet_')) return;

        // ── Session token guard: ignore if this order was already verified (refresh/back replay) ──
        const verifiedKey = 'fannex_verified_orders';
        let alreadyVerified = [];
        try { alreadyVerified = JSON.parse(sessionStorage.getItem(verifiedKey) || '[]'); } catch { }
        if (alreadyVerified.includes(orderId)) {
            // Replay attempt — strip URL and bail
            navigate('/wallet', { replace: true });
            return;
        }
        // Mark as verified immediately to prevent race conditions / double-calls
        sessionStorage.setItem(verifiedKey, JSON.stringify([...alreadyVerified, orderId]));

        verifiedRef.current = true;

        // Strip the order_id from the URL immediately
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

        // Verify payment server-side first, THEN show success screen
        api.post('/payment/wallet-verify', { orderId, amount })
            .then(r => {
                const newBalance = r.data.data?.walletBalance ?? 0;
                setBalance(newBalance);
                setSuccessBanner({ amount, newBalance, chatId });
                refreshUser().catch(() => { });
            })
            .catch(() => {
                fetchBalance();
            });

        fetchTransactions();
    }, []); // intentionally empty — only run on mount

    // ── Handle Recharge ─────────────────────────────────────────────────────────
    const handleRecharge = async () => {
        if (!finalAmount) { setError('Please select or enter an amount.'); return; }
        if (finalAmount < 1) { setError('Minimum recharge is ₹1 (payment gateway limit).'); return; }
        if (finalAmount > 50000) { setError('Maximum recharge is ₹50,000.'); return; }

        setLoading(true);
        setError('');
        setSuccessBanner(null);
        try {
            const { data } = await api.post('/payment/wallet-order', { amount: finalAmount });
            const order = data.data;
            if (!order?.paymentSessionId) throw new Error('Invalid order response. Please try again.');

            // Load Cashfree SDK dynamically (guard against duplicate script tags)
            if (!window.Cashfree) {
                const existingScript = document.querySelector('script[src*="cashfree"]');
                if (existingScript) {
                    await new Promise(r => { existingScript.addEventListener('load', r); setTimeout(r, 3000); });
                } else {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                        script.onload = resolve;
                        script.onerror = () => reject(new Error('Failed to load payment SDK'));
                        document.head.appendChild(script);
                    });
                }
            }

            // Store metadata for the success banner on return
            sessionStorage.setItem('fannex_wallet_recharge', JSON.stringify({
                orderId: order.orderId,
                amount: finalAmount,
            }));

            window.Cashfree({ mode: 'sandbox' }).checkout({
                paymentSessionId: order.paymentSessionId,
                redirectTarget: '_self',
            });
        } catch (err) {
            if (err.message !== 'dismissed') {
                setError(err?.response?.data?.message || err?.message || 'Recharge failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Success screen ───────────────────────────────────────────────────
    if (successBanner) {
        return (
            <div style={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #07070f 0%, #0c0a1a 100%)',
                fontFamily: "'Inter', sans-serif",
                padding: '24px 16px',
                position: 'relative',
                overflow: 'hidden',
            }}>
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
                        width: '100%',
                        maxWidth: 360,
                        textAlign: 'center',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* Check icon */}
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

                    {/* Message */}
                    <h1 style={{
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: 'clamp(20px, 5vw, 26px)',
                        margin: '0 0 10px',
                        letterSpacing: '-0.4px',
                        lineHeight: 1.2,
                    }}>
                        {successBanner.amount ? `₹${fmt(successBanner.amount)} Added to Wallet!` : 'Wallet Recharged! 🎉'}
                    </h1>

                    <p style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 15,
                        margin: '0 0 32px',
                        lineHeight: 1.6,
                    }}>
                        Your wallet has been topped up successfully.
                    </p>

                    {/* CTA button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <button
                            onClick={() => {
                                if (successBanner.chatId) {
                                    // replace: true removes the wallet page from history
                                    // so back-button from chat never returns here
                                    navigate(`/chat/${successBanner.chatId}`, { replace: true });
                                } else {
                                    navigate('/wallet', { replace: true });
                                }
                            }}
                            style={{
                                width: '100%',
                                height: 52,
                                borderRadius: 16,
                                background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: 16,
                                fontFamily: 'inherit',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <span style={{ fontSize: 18 }}>{successBanner.chatId ? '💬' : '👛'}</span>
                            {successBanner.chatId ? 'Go back to Chat' : 'Continue'}
                        </button>
                    </div>
                </motion.div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #07070f 0%, #0c0a1a 100%)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '32px 16px 60px',
            fontFamily: "'Inter', sans-serif",
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{ width: '100%', maxWidth: 480 }}
            >
                {/* ── Header row ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                    >
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>

                    {/* Go to Chat button */}
                    <Link
                        to="/subscriptions"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 999,
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(204,82,184,0.1))',
                            border: '1px solid rgba(124,58,237,0.3)',
                            color: '#a78bfa', fontWeight: 700, fontSize: 13,
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(204,82,184,0.18))'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(204,82,184,0.1))'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                    >
                        <span style={{ fontSize: 15 }}>💬</span>
                        Go to Chat
                    </Link>
                </div>

                {/* ── Success banner ── */}
                <AnimatePresence>
                    {successBanner && (
                        <motion.div
                            initial={{ opacity: 0, y: -12, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 0.97 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(16,185,129,0.06))',
                                border: '1px solid rgba(74,222,128,0.3)',
                                borderRadius: 18,
                                padding: '16px 20px',
                                marginBottom: 20,
                                display: 'flex', alignItems: 'center', gap: 14,
                            }}
                        >
                            <div style={{
                                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="#fff">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ color: '#4ade80', fontWeight: 800, fontSize: 15, margin: '0 0 2px' }}>
                                    {successBanner.amount ? `₹${fmt(successBanner.amount)} Added!` : 'Wallet Recharged! 🎉'}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
                                    New balance: <strong style={{ color: '#fff' }}>₹{fmt(successBanner.newBalance)}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setSuccessBanner(null)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}
                            >✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Wallet Card ── */}
                <div style={{
                    background: 'linear-gradient(160deg, #0a0a14, #100820)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 24,
                    padding: '32px 24px 28px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    marginBottom: 20,
                }}>
                    {/* Balance display */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c3aed, #cc52b8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 14px',
                            boxShadow: '0 8px 28px rgba(124,58,237,0.4)',
                        }}>
                            <span style={{ fontSize: 26 }}>💳</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Current Balance
                        </p>
                        <div style={{
                            fontSize: 40, fontWeight: 900, color: '#fff',
                            letterSpacing: '-0.8px', lineHeight: 1.1,
                        }}>
                            {loadingBal ? (
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 28 }}>Loading…</span>
                            ) : (
                                <>₹<span>{fmt(balance)}</span></>
                            )}
                        </div>
                    </div>

                    {/* Amount preset chips */}
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Add to Wallet
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                        {PRESETS.map(p => (
                            <motion.button
                                key={p}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setSelected(p); setCustomAmt(''); setError(''); }}
                                style={{
                                    borderRadius: 12, height: 48,
                                    background: selected === p
                                        ? 'linear-gradient(135deg, #7c3aed, #cc52b8)'
                                        : 'rgba(255,255,255,0.04)',
                                    border: selected === p ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                    color: selected === p ? '#fff' : 'rgba(255,255,255,0.6)',
                                    fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                                    cursor: 'pointer', transition: 'all 0.15s ease',
                                    boxShadow: selected === p ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                ₹{p}
                            </motion.button>
                        ))}
                    </div>

                    {/* Custom amount input */}
                    <div style={{ position: 'relative', marginBottom: 18 }}>
                        <span style={{
                            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                            color: customAmt ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                            fontWeight: 700, fontSize: 16, pointerEvents: 'none',
                        }}>₹</span>
                        <input
                            type="number"
                            min={1}
                            max={50000}
                            step={1}
                            placeholder="Custom amount (₹1 – ₹50,000)"
                            value={customAmt}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === '') { setCustomAmt(''); }
                                else {
                                    const n = parseFloat(val);
                                    if (!isNaN(n) && n >= 0) setCustomAmt(val);
                                }
                                setSelected(null); setError('');
                            }}
                            style={{
                                width: '100%', height: 48, boxSizing: 'border-box',
                                background: customAmt ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${customAmt ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 600,
                                fontFamily: 'inherit', paddingLeft: 30, paddingRight: 14,
                                outline: 'none', transition: 'all 0.2s ease',
                            }}
                        />
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                style={{
                                    color: '#f87171', fontSize: 13, marginBottom: 12,
                                    background: 'rgba(248,113,113,0.08)',
                                    border: '1px solid rgba(248,113,113,0.15)',
                                    borderRadius: 12, padding: '9px 14px',
                                }}
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Recharge button */}
                    <motion.button
                        whileTap={finalAmount && !loading ? { scale: 0.98 } : {}}
                        onClick={handleRecharge}
                        disabled={loading || !finalAmount}
                        style={{
                            width: '100%', height: 52, borderRadius: 16,
                            background: finalAmount && !loading
                                ? 'linear-gradient(135deg, #7c3aed, #cc52b8)'
                                : 'rgba(124,58,237,0.15)',
                            color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                            opacity: loading || !finalAmount ? 0.55 : 1,
                            cursor: loading || !finalAmount ? 'not-allowed' : 'pointer',
                            border: 'none', transition: 'all 0.2s ease',
                            boxShadow: finalAmount && !loading ? '0 6px 20px rgba(124,58,237,0.35)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                    >
                        {loading ? (
                            <>
                                <svg style={{ animation: 'spin 0.8s linear infinite' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                Processing…
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: 18 }}>⚡</span>
                                {finalAmount ? `Add ₹${fmt(finalAmount)} to Wallet` : 'Select an Amount'}
                            </>
                        )}
                    </motion.button>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

                    {/* Info note */}
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                        Funds added instantly after payment • Use to gift creators & more
                    </p>
                </div>

                {/* ── Quick Actions ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <Link
                        to="/subscriptions"
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '18px 12px', borderRadius: 18,
                            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                    >
                        <span style={{ fontSize: 26 }}>💬</span>
                        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>Go to Chat</span>
                    </Link>
                    <Link
                        to="/explore"
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '18px 12px', borderRadius: 18,
                            background: 'rgba(255,122,24,0.08)', border: '1px solid rgba(255,122,24,0.2)',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,122,24,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,122,24,0.35)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,122,24,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,122,24,0.2)'; }}
                    >
                        <span style={{ fontSize: 26 }}>🎁</span>
                        <span style={{ color: '#fb923c', fontWeight: 700, fontSize: 13 }}>Send a Gift</span>
                    </Link>
                </div>

                {/* ── Transaction History ── */}
                <div style={{
                    background: 'linear-gradient(160deg, #0a0a14, #100820)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 20,
                    overflow: 'hidden',
                }}>
                    <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: 0, letterSpacing: '-0.2px' }}>
                            Transaction History
                        </h2>
                    </div>

                    {loadingTx ? (
                        <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', width: '60%', marginBottom: 6 }} />
                                        <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)', width: '40%' }} />
                                    </div>
                                    <div style={{ height: 14, width: 50, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
                                </div>
                            ))}
                        </div>
                    ) : transactions.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, margin: 0 }}>
                                No recharges yet
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, margin: '4px 0 0' }}>
                                Your top-up history will appear here
                            </p>
                        </div>
                    ) : (
                        <div style={{ padding: '8px 0' }}>
                            {transactions.map((tx, i) => (
                                <div
                                    key={tx._id || i}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 20px',
                                        borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                        background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(16,185,129,0.08))',
                                        border: '1px solid rgba(74,222,128,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="#4ade80">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>

                                    {/* Details */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>
                                            Wallet Top-up
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {timeAgo(tx.createdAt)}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                                        +₹{fmt(tx.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
