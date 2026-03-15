import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ── Constants ──────────────────────────────────────────────────────────────────
const ISSUE_TYPE_LABELS = {
    bug:                 '🐛 Bug',
    payment_issue:       '💳 Payment',
    subscription_issue:  '🔒 Subscription',
    chat_issue:          '💬 Chat',
    content_issue:       '📸 Content',
    feature_request:     '✨ Feature Request',
    other:               '❓ Other',
};

const STATUS_CONFIG = {
    open:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Open' },
    reviewing: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  label: 'Reviewing' },
    resolved:  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Resolved' },
};

const PRIORITY_CONFIG = {
    low:    { color: '#22c55e', label: '🟢 Low' },
    medium: { color: '#f59e0b', label: '🟡 Medium' },
    high:   { color: '#ef4444', label: '🔴 High' },
};

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ text, color, bg }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 9px',
            borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            color, background: bg,
            border: `1px solid ${color}30`,
            whiteSpace: 'nowrap',
        }}>
            {text}
        </span>
    );
}

// ── Issue Detail Modal ─────────────────────────────────────────────────────────
function IssueModal({ issue, onClose, onUpdate }) {
    const [status, setStatus]     = useState(issue.status);
    const [notes, setNotes]       = useState(issue.adminNotes || '');
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState('');

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const { data } = await api.patch(`/issues/admin/${issue._id}`, { status, adminNotes: notes });
            onUpdate(data.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update.');
        } finally {
            setSaving(false);
        }
    };

    const sc = STATUS_CONFIG[status];

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#111118',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    width: '100%', maxWidth: 560,
                    maxHeight: '90vh', overflowY: 'auto',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
                }}
            >
                {/* Header */}
                <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
                            {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                        </p>
                        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{issue.title}</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>

                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Reporter info */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Badge text={STATUS_CONFIG[issue.status]?.label || issue.status} color={STATUS_CONFIG[issue.status]?.color} bg={STATUS_CONFIG[issue.status]?.bg} />
                        <Badge text={PRIORITY_CONFIG[issue.priority]?.label || issue.priority} color={PRIORITY_CONFIG[issue.priority]?.color || '#fff'} bg="rgba(255,255,255,0.06)" />
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                            {issue.userId?.name} · {issue.userId?.email} · {issue.userRole}
                        </span>
                    </div>

                    {/* Description */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Description</p>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{issue.description}</p>
                    </div>

                    {/* Screenshot */}
                    {issue.screenshotUrl && (
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Screenshot</p>
                            <a href={issue.screenshotUrl} target="_blank" rel="noreferrer">
                                <img src={issue.screenshotUrl} alt="Screenshot" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#000', cursor: 'zoom-in' }} />
                            </a>
                        </div>
                    )}

                    {/* Page URL + Device */}
                    {(issue.pageUrl || issue.deviceInfo) && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {issue.pageUrl && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: '0 0 4px', wordBreak: 'break-all' }}>🔗 <span style={{ color: 'rgba(255,255,255,0.55)' }}>{issue.pageUrl}</span></p>}
                            {issue.deviceInfo && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: 0, wordBreak: 'break-all' }}>💻 {issue.deviceInfo.slice(0, 200)}</p>}
                        </div>
                    )}

                    {/* Update status */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Update Status</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setStatus(key)}
                                    style={{
                                        flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                        border: status === key ? `1.5px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.08)',
                                        background: status === key ? cfg.bg : 'rgba(255,255,255,0.03)',
                                        color: status === key ? cfg.color : 'rgba(255,255,255,0.4)',
                                    }}
                                >
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Admin notes */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Admin Notes (internal)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="Internal notes visible only to admins…"
                            style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                                padding: '10px 12px', color: '#fff', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                            }}
                        />
                    </div>

                    {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            background: 'linear-gradient(90deg, #cc52b8, #7b5cff)',
                            border: 'none', borderRadius: 12, padding: '12px 20px',
                            color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.65 : 1,
                        }}
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main AdminIssues page ──────────────────────────────────────────────────────
export default function AdminIssues() {
    const [issues, setIssues]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [stats, setStats]             = useState(null);
    const [selected, setSelected]       = useState(null);
    const [filters, setFilters]         = useState({ status: '', issueType: '', priority: '' });
    const [page, setPage]               = useState(1);
    const [pagination, setPagination]   = useState({});
    const [error, setError]             = useState('');

    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (filters.status)    params.set('status',    filters.status);
            if (filters.issueType) params.set('issueType', filters.issueType);
            if (filters.priority)  params.set('priority',  filters.priority);

            const { data } = await api.get(`/issues/admin?${params.toString()}`);
            setIssues(data.data);
            setPagination(data.pagination);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load issues.');
        } finally {
            setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => { fetchIssues(); }, [fetchIssues]);

    useEffect(() => {
        api.get('/issues/admin/stats')
            .then(({ data }) => setStats(data.data))
            .catch(() => {});
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPage(1);
    };

    const handleUpdate = (updated) => {
        setIssues((prev) => prev.map((i) => i._id === updated._id ? updated : i));
    };

    const selectStyle = {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '8px 34px 8px 12px',
        color: '#fff',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.3)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
        backgroundSize: '16px',
    };

    return (
        <div className="p-6 max-w-6xl">
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 className="text-3xl font-black text-white">Issue Reports</h1>
                <p className="text-surface-400 mt-1">Review and manage user-submitted reports.</p>
            </div>

            {/* Stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: 'Open',      value: stats.open,      color: '#f59e0b' },
                        { label: 'Reviewing', value: stats.reviewing, color: '#3b82f6' },
                        { label: 'Resolved',  value: stats.resolved,  color: '#22c55e' },
                        { label: 'Total',     value: stats.total,     color: '#a78bfa' },
                    ].map((s) => (
                        <div key={s.label} className="glass rounded-2xl p-4 border border-white/5" style={{ cursor: 'default' }}>
                            <p style={{ fontSize: 26, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '4px 0 0' }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={selectStyle}>
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                </select>
                <select value={filters.issueType} onChange={(e) => handleFilterChange('issueType', e.target.value)} style={selectStyle}>
                    <option value="">All Types</option>
                    {Object.entries(ISSUE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)} style={selectStyle}>
                    <option value="">All Priorities</option>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                </select>
                {(filters.status || filters.issueType || filters.priority) && (
                    <button onClick={() => { setFilters({ status: '', issueType: '', priority: '' }); setPage(1); }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        ✕ Clear
                    </button>
                )}
            </div>

            {/* Error */}
            {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 16 }}>{error}</div>}

            {/* Table */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="glass rounded-xl border border-white/5 animate-pulse" style={{ height: 72 }} />
                    ))}
                </div>
            ) : issues.length === 0 ? (
                <div className="glass rounded-2xl border border-white/5 p-10 text-center">
                    <p style={{ fontSize: 40 }}>🎉</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>No issues found matching your filters.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {issues.map((issue) => {
                        const sc = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
                        const pc = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
                        return (
                            <div
                                key={issue._id}
                                onClick={() => setSelected(issue)}
                                className="glass rounded-xl border border-white/5 hover:border-white/15 transition-all cursor-pointer"
                                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
                            >
                                {/* Priority dot */}
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: pc.color, flexShrink: 0, boxShadow: `0 0 8px ${pc.color}60` }} />

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                                            {issue.title}
                                        </span>
                                        <Badge text={sc.label} color={sc.color} bg={sc.bg} />
                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                                            {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{issue.userId?.name || 'Unknown'}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>{new Date(issue.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        {issue.screenshotUrl && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>📎 Screenshot</span>}
                                    </div>
                                </div>

                                {/* Arrow */}
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: page <= 1 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                        ← Prev
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Page {page} of {pagination.totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 16px', color: page >= pagination.totalPages ? 'rgba(255,255,255,0.2)' : '#fff', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                        Next →
                    </button>
                </div>
            )}

            {/* Issue detail modal */}
            {selected && (
                <IssueModal
                    issue={selected}
                    onClose={() => setSelected(null)}
                    onUpdate={handleUpdate}
                />
            )}
        </div>
    );
}
