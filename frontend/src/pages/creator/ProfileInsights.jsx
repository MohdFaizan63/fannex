import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import insightsService from '../../services/insightsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr, range) {
    const parts = dateStr.split('-');
    if (range === 'year') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[parseInt(parts[1], 10) - 1] || dateStr;
    }
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.toLocaleDateString('en-IN', { month: 'short' })} ${String(d.getDate()).padStart(2, '0')}`;
}

function formatCurrency(val) {
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatNumber(val) {
    return Number(val).toLocaleString('en-IN');
}

// ── Area Chart (canvas-based) ──────────────────────────────────────────────────

function AreaChart({ dataPoints, range, prefix = '', isCurrency = false, accentColor = '#10b981' }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const pointsRef = useRef([]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !dataPoints?.length) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const W = rect.width;
        const H = 220;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const paddingLeft = 10;
        const paddingRight = 10;
        const paddingTop = 30;
        const paddingBottom = 40;
        const chartW = W - paddingLeft - paddingRight;
        const chartH = H - paddingTop - paddingBottom;

        const values = dataPoints.map(d => d.value);
        const maxVal = Math.max(...values, 1);

        const stepX = dataPoints.length > 1 ? chartW / (dataPoints.length - 1) : chartW / 2;

        // Build points
        const pts = dataPoints.map((d, i) => ({
            x: paddingLeft + (dataPoints.length > 1 ? i * stepX : chartW / 2),
            y: paddingTop + chartH - (d.value / maxVal) * chartH,
            value: d.value,
            date: d.date,
        }));
        pointsRef.current = pts;

        // Clear
        ctx.clearRect(0, 0, W, H);

        // Grid lines
        const gridLines = 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridLines; i++) {
            const y = paddingTop + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(W - paddingRight, y);
            ctx.stroke();
        }

        // Area fill
        const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
        gradient.addColorStop(0, accentColor + '40');
        gradient.addColorStop(1, accentColor + '05');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, paddingTop + chartH);
        pts.forEach((p, i) => {
            if (i === 0) {
                ctx.lineTo(p.x, p.y);
            } else {
                // Smooth curve
                const prev = pts[i - 1];
                const cpX = (prev.x + p.x) / 2;
                ctx.bezierCurveTo(cpX, prev.y, cpX, p.y, p.x, p.y);
            }
        });
        ctx.lineTo(pts[pts.length - 1].x, paddingTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        pts.forEach((p, i) => {
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                const prev = pts[i - 1];
                const cpX = (prev.x + p.x) / 2;
                ctx.bezierCurveTo(cpX, prev.y, cpX, p.y, p.x, p.y);
            }
        });
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Dots
        pts.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = accentColor;
            ctx.fill();
        });

        // X axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const maxLabels = W < 400 ? 5 : 8;
        const labelStep = Math.max(1, Math.ceil(dataPoints.length / maxLabels));
        pts.forEach((p, i) => {
            if (i % labelStep === 0 || i === pts.length - 1) {
                ctx.fillText(formatDateLabel(dataPoints[i].date, range), p.x, H - 8);
            }
        });
    }, [dataPoints, range, accentColor]);

    useEffect(() => {
        draw();
        const handleResize = () => draw();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas || !pointsRef.current.length) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        let closest = null, minDist = Infinity;
        pointsRef.current.forEach(p => {
            const d = Math.abs(p.x - mouseX);
            if (d < minDist) { minDist = d; closest = p; }
        });
        if (closest && minDist < 40) {
            setTooltip(closest);
        } else {
            setTooltip(null);
        }
    };

    const handleTouchMove = (e) => {
        const touch = e.touches[0];
        if (touch) handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    };

    const displayValue = tooltip
        ? (isCurrency ? formatCurrency(tooltip.value) : formatNumber(tooltip.value))
        : null;

    return (
        <div ref={containerRef} className="relative w-full" style={{ minHeight: 220 }}>
            <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(null)}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setTooltip(null)}
            />
            {tooltip && (
                <div
                    className="absolute pointer-events-none z-10 px-3 py-2 rounded-xl text-xs font-semibold shadow-xl"
                    style={{
                        left: Math.min(Math.max(tooltip.x - 40, 8), (containerRef.current?.offsetWidth || 300) - 100),
                        top: tooltip.y - 48,
                        background: 'rgba(20,20,20,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <p className="text-white text-sm font-bold">{prefix}{displayValue}</p>
                    <p className="text-surface-400 text-[10px] mt-0.5">
                        {formatDateLabel(tooltip.date, range)} {new Date(tooltip.date).getFullYear()}
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Timeline Dot Chart (for earnings) ──────────────────────────────────────────

function TimelineDotChart({ dataPoints, range, isCurrency = true }) {
    const containerRef = useRef(null);
    const [activeDot, setActiveDot] = useState(0);

    if (!dataPoints?.length) return null;

    const maxVal = Math.max(...dataPoints.map(d => d.value), 1);

    return (
        <div ref={containerRef} className="w-full">
            {/* Active dot value */}
            <div className="mb-4">
                <p className="text-2xl font-black text-white">
                    {isCurrency ? formatCurrency(dataPoints[activeDot]?.value ?? 0) : formatNumber(dataPoints[activeDot]?.value ?? 0)}
                </p>
                <p className="text-xs text-surface-500 mt-0.5">
                    {formatDateLabel(dataPoints[activeDot]?.date, range)} {new Date(dataPoints[activeDot]?.date + 'T00:00:00').getFullYear()}
                </p>
            </div>

            {/* Timeline */}
            <div className="relative w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex items-end gap-0 min-w-max px-1" style={{ minHeight: 80 }}>
                    {dataPoints.map((d, i) => {
                        const barH = Math.max(4, (d.value / maxVal) * 50);
                        const isActive = i === activeDot;
                        return (
                            <div
                                key={d.date}
                                className="flex flex-col items-center cursor-pointer group"
                                style={{ minWidth: 44 }}
                                onClick={() => setActiveDot(i)}
                            >
                                {/* Bar */}
                                <div
                                    className="rounded-full transition-all duration-200"
                                    style={{
                                        width: isActive ? 10 : 6,
                                        height: barH,
                                        background: isActive
                                            ? 'linear-gradient(to top, #f59e0b, #fbbf24)'
                                            : d.value > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)',
                                    }}
                                />

                                {/* Dot */}
                                <div className="relative mt-2">
                                    <div
                                        className="rounded-full border-2 transition-all duration-200"
                                        style={{
                                            width: isActive ? 14 : 10,
                                            height: isActive ? 14 : 10,
                                            background: isActive ? '#f59e0b' : d.value > 0 ? '#f59e0b' : 'transparent',
                                            borderColor: isActive ? '#f59e0b' : d.value > 0 ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                                        }}
                                    />
                                </div>

                                {/* Label */}
                                <p className={`text-[9px] mt-1.5 transition-colors ${isActive ? 'text-white font-semibold' : 'text-surface-400'}`}>
                                    {formatDateLabel(d.date, range)}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Timeline line */}
                <div className="absolute left-0 right-0 bottom-[28px] h-px bg-white/5" />
            </div>
        </div>
    );
}

// ── Overview Stat Card ─────────────────────────────────────────────────────────

function OverviewCard({ icon, label, value, gradient }) {
    return (
        <div className="glass rounded-2xl p-4 border border-white/5 relative overflow-hidden">
            <div className={`absolute inset-0 opacity-[0.04] rounded-2xl ${gradient}`} />
            <div className="relative">
                <span className="text-xl mb-2 block">{icon}</span>
                <p className="text-lg sm:text-xl font-black text-white">{value}</p>
                <p className="text-[10px] uppercase tracking-widest text-surface-300 font-medium mt-1">{label}</p>
            </div>
        </div>
    );
}

// ── Range Tab Selector ─────────────────────────────────────────────────────────

const RANGES = [
    { key: 'week', label: 'Weekly' },
    { key: 'month', label: 'Monthly' },
    { key: 'year', label: 'Yearly' },
];

function RangeSelector({ value, onChange }) {
    return (
        <div className="flex bg-surface-800/80 rounded-xl p-1 border border-white/5">
            {RANGES.map(r => (
                <button
                    key={r.key}
                    onClick={() => onChange(r.key)}
                    className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${value === r.key
                            ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30 shadow-sm'
                            : 'text-surface-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ProfileInsights() {
    const [range, setRange] = useState('week');
    const [views, setViews] = useState(null);
    const [earnings, setEarnings] = useState(null);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.allSettled([
            insightsService.getProfileViews(range),
            insightsService.getEarnings(range),
            insightsService.getOverview(),
        ]).then(([vRes, eRes, oRes]) => {
            if (vRes.status === 'fulfilled') setViews(vRes.value.data?.data);
            if (eRes.status === 'fulfilled') setEarnings(eRes.value.data?.data);
            if (oRes.status === 'fulfilled') setOverview(oRes.value.data?.data);
        }).finally(() => setLoading(false));
    }, [range]);

    const dateRangeLabel = views
        ? `${formatDateLabel(views.startDate, range)} - ${formatDateLabel(views.endDate, range)}`
        : '—';

    return (
        <div className="p-4 sm:p-6 w-full max-w-4xl mx-auto pb-24">

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link
                    to="/dashboard"
                    className="w-9 h-9 rounded-xl bg-surface-800/80 border border-white/5 flex items-center justify-center text-surface-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white">Profile Insights</h1>
                    <p style={{ color: 'rgba(255,255,255,0.72)' }} className="text-xs mt-0.5">Track your performance & growth</p>
                </div>
            </div>

            {/* Range selector */}
            <div className="mb-6">
                <RangeSelector value={range} onChange={setRange} />
            </div>

            {loading ? (
                <div className="space-y-6">
                    {[1, 2].map(i => (
                        <div key={i} className="glass rounded-2xl border border-white/5 p-5">
                            <div className="skeleton h-4 w-32 mb-3" />
                            <div className="skeleton h-8 w-20 mb-4" />
                            <div className="skeleton h-48 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-5">

                    {/* ── Profile Views Chart ────────────────────────────── */}
                    <div className="glass rounded-2xl border border-white/5 p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <h2 className="text-sm font-semibold text-surface-300">App/Website Visits</h2>
                                <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                                    {formatNumber(views?.total ?? 0)}
                                </p>
                                <p className="text-xs text-surface-400 mt-0.5">{dateRangeLabel}</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="mt-4">
                            <AreaChart
                                dataPoints={views?.dataPoints ?? []}
                                range={range}
                                accentColor="#10b981"
                            />
                        </div>
                    </div>

                    {/* ── Earnings Chart ──────────────────────────────────── */}
                    <div className="glass rounded-2xl border border-white/5 p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <h2 className="text-sm font-semibold text-surface-300">Total Earning by Order</h2>
                                <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                                    {formatCurrency(earnings?.total ?? 0)}
                                </p>
                                <p className="text-xs text-surface-400 mt-0.5">{dateRangeLabel}</p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="mt-2 border-t border-white/5 pt-4">
                            <TimelineDotChart
                                dataPoints={earnings?.dataPoints ?? []}
                                range={range}
                                isCurrency={true}
                            />
                        </div>
                    </div>

                    {/* ── Overview Cards ──────────────────────────────────── */}
                    <div>
                        <h2 className="text-sm font-bold text-white mb-3">Overview</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <OverviewCard
                                icon="👁️" label="Total Views"
                                value={formatNumber(overview?.totalViews ?? 0)}
                                gradient="bg-emerald-500"
                            />
                            <OverviewCard
                                icon="💰" label="Total Earnings"
                                value={formatCurrency(overview?.totalEarnings ?? 0)}
                                gradient="bg-amber-500"
                            />
                            <OverviewCard
                                icon="👥" label="Subscribers"
                                value={formatNumber(overview?.totalSubscribers ?? 0)}
                                gradient="bg-brand-500"
                            />
                            <OverviewCard
                                icon="📸" label="Total Posts"
                                value={formatNumber(overview?.totalPosts ?? 0)}
                                gradient="bg-violet-500"
                            />
                        </div>
                    </div>

                    {/* ── Pro Tips ────────────────────────────────────────── */}
                    <div className="glass rounded-2xl border border-brand-500/20 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 text-base">
                                💡
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white mb-1">Pro Tips</h3>
                                <ul className="space-y-1.5 text-xs text-surface-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-brand-400 mt-0.5">•</span>
                                        Post consistently to keep your audience engaged
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-brand-400 mt-0.5">•</span>
                                        Share your profile link on social media for more visits
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-brand-400 mt-0.5">•</span>
                                        Enable chat to earn more from direct conversations
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
