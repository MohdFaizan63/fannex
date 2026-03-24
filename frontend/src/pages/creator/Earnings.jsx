import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import payoutService from '../../services/payoutService';
import { formatCurrency, formatDate, formatDateTime, getErrorMessage } from '../../utils/helpers';

// ── Icons (inline SVG for zero dependency) ───────────────────────────────────
const Icon = {
    wallet:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M19 7H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 12a1 1 0 100 2 1 1 0 000-2z" fill="currentColor" stroke="none"/><path d="M3 7l9-4 9 4"/></svg>,
    clock:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
    check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M20 6L9 17l-5-5"/></svg>,
    gift:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><rect x="3" y="9" width="18" height="13" rx="1"/><path d="M3 9h18M12 9V22M8 9c0-2 1-4 4-4s4 2 4 4"/></svg>,
    chat:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    sub:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    dream:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    arrow:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
    payout:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    refresh:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>,
    empty:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 opacity-30"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    close:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ── Type config — BUG-24 Fix: added dream_fund ────────────────────────────────
const TYPE_CONFIG = {
    subscription: {
        label: 'Subscription',
        icon: Icon.sub,
        color: 'text-violet-400',
        bg: 'bg-violet-500/15',
        border: 'border-violet-500/20',
        filterKey: 'subscription',
    },
    gift: {
        label: 'Gift',
        icon: Icon.gift,
        color: 'text-rose-400',
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/20',
        filterKey: 'gift',
    },
    chat_unlock: {
        label: 'Chat Unlock',
        icon: Icon.chat,
        color: 'text-sky-400',
        bg: 'bg-sky-500/15',
        border: 'border-sky-500/20',
        filterKey: 'chat_unlock',
    },
    // BUG-24 Fix: Dream Fund is now a proper type with its own config
    dream_fund: {
        label: 'Dream Fund',
        icon: Icon.dream,
        color: 'text-amber-400',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/20',
        filterKey: 'dream_fund',
    },
};

// ── Status pill ───────────────────────────────────────────────────────────────
const PAYOUT_STATUS = {
    pending:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    approved: 'bg-blue-500/15  text-blue-400  border-blue-500/25',
    paid:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    rejected: 'bg-red-500/15  text-red-400   border-red-500/25',
};

function StatusPill({ status }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${PAYOUT_STATUS[status] ?? 'bg-surface-700 text-surface-400 border-white/10'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
            {status}
        </span>
    );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`skeleton rounded-lg animate-pulse ${className}`} />;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, gradient, loading, chip, subLabel }) {
    return (
        <div className={`
            relative overflow-hidden glass rounded-2xl p-5 border transition-all duration-300
            hover:-translate-y-1 hover:shadow-2xl group
            ${accent ? 'border-brand-500/30 hover:border-brand-500/60' : 'border-white/5 hover:border-white/10'}
        `}>
            {accent && (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center mb-4
                ${gradient || (accent ? 'bg-gradient-to-br from-brand-600/30 to-violet-600/20 text-brand-400' : 'bg-surface-700/60 text-surface-400')}
            `}>
                {loading ? <Skeleton className="w-5 h-5 rounded" /> : icon}
            </div>

            {chip && !loading && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/20">
                    {chip}
                </span>
            )}

            {loading ? (
                <>
                    <Skeleton className="h-7 w-28 mb-2" />
                    <Skeleton className="h-3 w-20" />
                </>
            ) : (
                <>
                    <p className={`text-2xl font-black tracking-tight mb-1 ${accent ? 'gradient-text' : 'text-white'}`}>
                        {formatCurrency(value)}
                    </p>
                    <p className="text-xs uppercase tracking-widest text-surface-500 font-medium">{label}</p>
                    {subLabel && (
                        <p className="text-[10px] text-emerald-400/70 mt-1 font-medium">{subLabel}</p>
                    )}
                </>
            )}
        </div>
    );
}

// ── Payout Request Modal ──────────────────────────────────────────────────────
// BUG-26/BUG-28 Fix: when maxAmount <= 0, hide the form entirely and show warning only
function PayoutModal({ maxAmount, onClose, onSuccess }) {
    const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
    const overlayRef = useRef();

    const onSubmit = async ({ amount }) => {
        try {
            await payoutService.requestPayout(parseFloat(amount));
            onSuccess();
        } catch (err) {
            setError('amount', { message: getErrorMessage(err) });
        }
    };

    return (
        <div
            ref={overlayRef}
            onClick={(e) => e.target === overlayRef.current && onClose()}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md px-4 pb-safe"
        >
            <div className="glass rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full max-w-sm border border-white/10 animate-fade-in-up shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Request Payout</h3>
                        <p className="text-sm text-surface-400 mt-0.5">
                            Available: <span className="text-emerald-400 font-semibold">{formatCurrency(maxAmount)}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-surface-700/60 hover:bg-surface-600 text-surface-400 hover:text-white transition-all flex items-center justify-center"
                    >
                        {Icon.close}
                    </button>
                </div>

                {/* BUG-26/28 Fix: show only the warning when no balance; do NOT render the form */}
                {maxAmount <= 0 ? (
                    <div className="mb-5 px-4 py-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center flex flex-col items-center gap-3">
                        <span className="text-3xl">💸</span>
                        <p className="font-semibold">No pending balance available.</p>
                        <p className="text-xs text-amber-400/70">Earnings from new payments will appear here once processed.</p>
                        <button onClick={onClose} className="mt-1 btn-outline px-6 py-2 text-sm">Close</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-surface-300 mb-2">Amount (₹)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 font-bold text-lg">₹</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    max={maxAmount}
                                    placeholder="0.00"
                                    className="input-dark pl-10 w-full h-12 text-lg font-semibold"
                                    {...register('amount', {
                                        required: 'Enter an amount',
                                        // BUG-26 Fix: validate v > 0 explicitly to catch cleared/0 inputs
                                        validate: (v) => {
                                            const n = parseFloat(v);
                                            if (isNaN(n) || n <= 0) return 'Enter a valid amount greater than ₹0';
                                            if (n < 1) return 'Minimum payout is ₹1';
                                            if (n > maxAmount) return `Max available is ${formatCurrency(maxAmount)}`;
                                            return true;
                                        },
                                    })}
                                />
                            </div>
                            {errors.amount && <p className="mt-1.5 text-xs text-red-400">{errors.amount.message}</p>}
                        </div>

                        <div className="flex gap-3 mt-1">
                            <button type="button" onClick={onClose} className="btn-outline flex-1 h-12">Cancel</button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-brand flex-1 h-12 disabled:opacity-40"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending…
                                    </span>
                                ) : 'Request Payout'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ tx }) {
    const cfg = TYPE_CONFIG[tx.type] ?? {
        label: tx.type, icon: Icon.wallet, color: 'text-surface-400', bg: 'bg-surface-700/40', border: 'border-white/5',
    };
    const fan = tx.userId;
    // BUG-30 Fix: provide a meaningful fallback label for dream_fund contributors
    const fanName = fan?.name || fan?.username
        ? (fan.name || fan.username)
        : tx.type === 'dream_fund' ? 'Dream Fund Contributor' : 'Anonymous Fan';

    return (
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-0">
            {/* Type icon */}
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                {cfg.icon}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-sm text-surface-400 truncate mt-0.5">{fanName}</p>
                <p className="text-xs text-surface-500 mt-0.5">{formatDate(tx.createdAt)}</p>
            </div>

            {/* Amount */}
            <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-emerald-400">+{formatCurrency(tx.creatorEarning)}</p>
            </div>
        </div>
    );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children, count }) {
    return (
        <button
            onClick={onClick}
            className={`
                relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap
                ${active
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-white/5 border border-transparent'
                }
            `}
        >
            {children}
            {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-brand-500/30 text-brand-300' : 'bg-surface-700 text-surface-500'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

// ── Main Earnings Page ────────────────────────────────────────────────────────
export default function Earnings() {
    const [earnings, setEarnings]           = useState(null);
    const [payouts, setPayouts]             = useState([]);
    // BUG-24 Fix: added dream_fund to breakdown state
    const [breakdown, setBreakdown]         = useState({ subscription: 0, gift: 0, chat_unlock: 0, dream_fund: 0 });
    const [breakdownLoading, setBreakdownLoading] = useState(false); // BUG-29 Fix: separate loading state for breakdown
    const [history, setHistory]             = useState({ transactions: [], pagination: null });
    const [historyLoading, setHistoryLoading] = useState(false);
    const [loading, setLoading]             = useState(true);
    const [showModal, setShowModal]         = useState(false);
    const [successMsg, setSuccessMsg]       = useState('');
    // BUG-27 Fix: renamed activeSection key from 'overview' → 'payouts'
    const [activeSection, setActiveSection] = useState('payouts');
    const [historyFilter, setHistoryFilter] = useState('all');
    const [historyPage, setHistoryPage]     = useState(1);

    const toastTimerRef = useRef(null);

    /** Fetch earnings summary */
    const loadEarnings = useCallback(async () => {
        setLoading(true);
        try {
            const [eRes, pRes] = await Promise.allSettled([
                payoutService.getEarnings(),
                payoutService.listMyPayouts({ limit: 50, sort: '-requestedAt' }),
            ]);
            if (eRes.status === 'fulfilled') {
                const data = eRes.value.data?.data ?? eRes.value.data;
                setEarnings(data);
                if (data?.breakdown) setBreakdown(prev => ({ ...prev, ...data.breakdown }));
            }
            if (pRes.status === 'fulfilled') setPayouts(pRes.value.data?.results ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    // BUG-29 Fix: loadHistory now toggles breakdownLoading alongside historyLoading
    const loadHistory = useCallback(async (type, page) => {
        setHistoryLoading(true);
        setBreakdownLoading(true);
        try {
            const res = await payoutService.getEarningsHistory({ type, page, limit: 20 });
            const data = res.data?.data ?? {};
            setHistory({ transactions: data.transactions ?? [], pagination: data.pagination ?? null });
            if (data.breakdown) setBreakdown(prev => ({ ...prev, ...data.breakdown }));
        } catch {
            setHistory({ transactions: [], pagination: null });
        } finally {
            setHistoryLoading(false);
            setBreakdownLoading(false);
        }
    }, []);

    // Mount: load earnings summary
    useEffect(() => { loadEarnings(); }, [loadEarnings]);

    // BUG-20 Fix: single consolidated effect — only the historyParamsRef approach, no duplicate prevSectionRef effect
    const historyParamsRef = useRef({ section: null, filter: 'all', page: 1 });
    useEffect(() => {
        if (activeSection !== 'history') return;
        const prev = historyParamsRef.current;
        // Fire when anything changed (section activation OR filter/page change)
        if (prev.section !== 'history' || prev.filter !== historyFilter || prev.page !== historyPage) {
            historyParamsRef.current = { section: 'history', filter: historyFilter, page: historyPage };
            loadHistory(historyFilter, historyPage);
        }
    }, [activeSection, historyFilter, historyPage, loadHistory]);

    // BUG-21 Fix: allow same-filter click to refresh (removed early-return no-op guard)
    const handleFilterChange = (f) => {
        const isSame = f === historyFilter;
        if (!isSame) {
            setHistoryFilter(f);
            setHistoryPage(1);
            historyParamsRef.current = { section: 'history', filter: f, page: 1 };
        }
        // Always reload on click — even same filter means "refresh"
        if (activeSection === 'history') loadHistory(f, isSame ? historyPage : 1);
    };

    const handlePayoutSuccess = () => {
        setShowModal(false);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setSuccessMsg("Payout request submitted! We'll process it within 2 business days.");
        loadEarnings();
        toastTimerRef.current = setTimeout(() => setSuccessMsg(''), 6000);
    };

    const lastPaidPayout = payouts.find((p) => p.status === 'paid');
    const paidSubLabel = lastPaidPayout?.processedAt
        ? `Paid on: ${formatDateTime(lastPaidPayout.processedAt)}`
        : null;

    // Main stat cards (3 top cards)
    const mainCards = [
        { icon: Icon.wallet, label: 'Total Earned',    value: earnings?.totalEarned ?? 0,    accent: true, chip: 'lifetime' },
        { icon: Icon.clock,  label: 'Pending Balance', value: earnings?.pendingAmount ?? 0,   accent: false },
        // BUG-22 Fix: renamed "Paid Amount" → "Withdrawn" with subLabel clarification
        { icon: Icon.check,  label: 'Withdrawn',       value: earnings?.withdrawnAmount ?? 0, accent: false, subLabel: paidSubLabel ?? 'Admin confirmed & transferred' },
    ];

    // BUG-23/BUG-24 Fix: typeCards now use stable filterKey; dream_fund added as 4th card
    const typeCards = [
        { icon: Icon.sub,   label: 'Subscription Earn', value: breakdown.subscription ?? 0, gradient: 'bg-violet-500/15 text-violet-400', filterKey: 'subscription' },
        { icon: Icon.gift,  label: 'Gift Earnings',      value: breakdown.gift ?? 0,          gradient: 'bg-rose-500/15 text-rose-400',     filterKey: 'gift' },
        { icon: Icon.chat,  label: 'Chat Earnings',      value: breakdown.chat_unlock ?? 0,   gradient: 'bg-sky-500/15 text-sky-400',       filterKey: 'chat_unlock' },
        { icon: Icon.dream, label: 'Dream Fund',         value: breakdown.dream_fund ?? 0,    gradient: 'bg-amber-500/15 text-amber-400',   filterKey: 'dream_fund' },
    ];

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Earnings</h1>
                    <p style={{ color: 'rgba(255,255,255,0.42)' }} className="mt-1 text-sm sm:text-base">Track your income and request payouts.</p>
                </div>
                {/* BUG-19 Fix: "Request Payout" CTA button in the page header — always visible */}
                <button
                    onClick={() => setShowModal(true)}
                    disabled={loading}
                    className="btn-brand px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 self-start sm:self-auto disabled:opacity-40"
                >
                    {Icon.payout}
                    Request Payout
                </button>
            </div>

            {/* ── Success toast ───────────────────────────────────────────── */}
            {successMsg && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
                    {successMsg}
                </div>
            )}

            {/* ── Main stat cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                {mainCards.map((c) => (
                    <StatCard key={c.label} {...c} loading={loading} />
                ))}
            </div>

            {/* ── Earnings breakdown cards ─────────────────────────────────── */}
            {/* BUG-24 Fix: 4-column grid for 4 type cards (subscription/gift/chat/dream) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                {typeCards.map((c) => (
                    <div
                        key={c.label}
                        className="glass rounded-2xl p-4 sm:p-5 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-0.5 cursor-pointer"
                        // BUG-23 Fix: use stable filterKey, not label string comparison
                        onClick={() => {
                            setActiveSection('history');
                            handleFilterChange(c.filterKey);
                        }}
                    >
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-3 ${c.gradient}`}>
                            {c.icon}
                        </div>
                        {/* BUG-29 Fix: show skeleton for breakdown values during filter changes */}
                        {(loading || breakdownLoading) ? (
                            <Skeleton className="h-6 w-16 mb-1" />
                        ) : (
                            <p className="text-lg sm:text-xl font-black text-white">{formatCurrency(c.value)}</p>
                        )}
                        <p className="text-xs text-surface-500 font-medium mt-0.5 leading-tight">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Section tabs ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hidden">
                {/* BUG-27 Fix: tab state key is now 'payouts' (not 'overview') */}
                <Tab active={activeSection === 'payouts'} onClick={() => setActiveSection('payouts')}>
                    📤 Payout History
                </Tab>
                <Tab
                    active={activeSection === 'history'}
                    onClick={() => {
                        if (activeSection !== 'history') setActiveSection('history');
                    }}
                >
                    📈 Earning History
                </Tab>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                SECTION: PAYOUT HISTORY (BUG-27: was 'overview', now 'payouts')
                ════════════════════════════════════════════════════════════════ */}
            {activeSection === 'payouts' && (
                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    <div className="px-4 sm:px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="font-bold text-white text-base sm:text-lg">Payout History</h2>
                        <span className="text-xs text-surface-500">{payouts.length} request{payouts.length !== 1 ? 's' : ''}</span>
                    </div>

                    {loading ? (
                        <div className="divide-y divide-white/[0.04]">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="px-5 py-4 flex items-center gap-4">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                    <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : payouts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
                            {Icon.empty}
                            <p className="mt-4 text-sm">No payout requests yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {['Date', 'Amount', 'Status', 'Processed'].map((h) => (
                                            <th key={h} className="px-4 sm:px-5 py-3 text-left text-xs uppercase tracking-widest text-surface-500 font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {payouts.map((p) => (
                                        <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 sm:px-5 py-4 text-surface-300 text-xs sm:text-sm whitespace-nowrap">
                                                {formatDate(p.requestedAt ?? p.createdAt)}
                                            </td>
                                            <td className="px-4 sm:px-5 py-4 font-bold text-white whitespace-nowrap">
                                                {formatCurrency(p.amount)}
                                            </td>
                                            <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                                                <StatusPill status={p.status} />
                                            </td>
                                            <td className="px-4 sm:px-5 py-4 text-surface-500 text-xs whitespace-nowrap">
                                                {p.processedAt ? formatDate(p.processedAt) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                SECTION: EARNING HISTORY
                ════════════════════════════════════════════════════════════════ */}
            {activeSection === 'history' && (
                <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                    {/* Filter tabs */}
                    <div className="px-4 sm:px-5 py-3 border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-hidden">
                        {[
                            { key: 'all',        label: 'All',          icon: '⚡' },
                            { key: 'subscription', label: 'Subscriptions', icon: '👥' },
                            { key: 'gift',       label: 'Gifts',         icon: '🎁' },
                            { key: 'chat_unlock', label: 'Chat',          icon: '💬' },
                            // BUG-24 Fix: Dream Fund filter tab
                            { key: 'dream_fund', label: 'Dream Fund',    icon: '⭐' },
                        ].map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => handleFilterChange(key)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                                    ${historyFilter === key
                                        ? 'bg-brand-600/25 text-brand-300 border border-brand-500/30'
                                        : 'text-surface-400 hover:text-surface-200 hover:bg-white/5 border border-transparent'
                                    }
                                `}
                            >
                                <span>{icon}</span> {label}
                            </button>
                        ))}
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-surface-600 whitespace-nowrap">
                                {history.pagination?.total ?? 0} transactions
                            </span>
                            <button
                                onClick={() => loadHistory(historyFilter, historyPage)}
                                className="w-7 h-7 rounded-lg bg-surface-700/50 hover:bg-surface-600 text-surface-400 hover:text-white transition-all flex items-center justify-center"
                            >
                                {Icon.refresh}
                            </button>
                        </div>
                    </div>

                    {/* Transactions */}
                    {historyLoading ? (
                        <div>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
                                    <Skeleton className="w-10 h-10 rounded-xl" />
                                    <div className="flex-1">
                                        <Skeleton className="h-3 w-24 mb-2" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                    <Skeleton className="h-5 w-16" />
                                </div>
                            ))}
                        </div>
                    ) : history.transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
                            {Icon.empty}
                            <p className="mt-4 text-sm">No transactions found.</p>
                            <p className="mt-1 text-xs text-surface-600">Earnings will appear here after fans pay.</p>
                        </div>
                    ) : (
                        <div>
                            {history.transactions.map((tx) => (
                                <TxRow key={tx._id} tx={tx} />
                            ))}
                        </div>
                    )}

                    {/* Pagination — BUG-25 Fix: scroll to top on page change */}
                    {history.pagination && history.pagination.pages > 1 && (
                        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-surface-500">
                                Page {historyPage} of {history.pagination.pages}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={historyPage <= 1}
                                    onClick={() => {
                                        setHistoryPage((p) => Math.max(1, p - 1));
                                        // BUG-25 Fix: scroll to top when paginating
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={historyPage >= history.pagination.pages}
                                    onClick={() => {
                                        setHistoryPage((p) => p + 1);
                                        // BUG-25 Fix: scroll to top when paginating
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="btn-outline text-xs px-3 py-1.5 disabled:opacity-30"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Payout Modal ─────────────────────────────────────────────── */}
            {showModal && (
                <PayoutModal
                    maxAmount={earnings?.pendingAmount ?? 0}
                    onClose={() => setShowModal(false)}
                    onSuccess={handlePayoutSuccess}
                />
            )}
        </div>
    );
}
