import { useState, useEffect, useRef, useCallback } from 'react';
import dreamFundService from '../services/dreamFundService';

const STATUS_LABEL = {
    pending: { label: '⏳ Pending Approval', color: '#f59e0b' },
    approved: { label: '✅ Active', color: '#22c55e' },
    rejected: { label: '❌ Rejected', color: '#f87171' },
    completed: { label: '🎉 Completed', color: '#a855f7' },
    awaiting_verification: { label: '📎 Awaiting Proof Verification', color: '#60a5fa' },
    verified: { label: '✓ Verified', color: '#4ade80' },
};

export default function DreamFundManagerModal({ onClose }) {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); // 'list' | 'create' | 'proof'
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const imageRef = useRef(null);
    const proofRef = useRef(null);

    const loadGoals = useCallback(() => {
        setLoading(true);
        dreamFundService.getMyGoals()
            .then(r => setGoals(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadGoals(); }, [loadGoals]);

    const handleCreate = async () => {
        setError(''); setSuccess('');
        if (!title.trim() || !targetAmount) {
            setError('Title and target amount are required');
            return;
        }
        if (Number(targetAmount) < 100) {
            setError('Minimum target amount is ₹100');
            return;
        }
        if (goals.filter(g => ['pending','approved','completed','awaiting_verification'].includes(g.status)).length >= 3) {
            setError('You can have at most 3 active Dream Fund goals');
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('description', description.trim());
            fd.append('targetAmount', targetAmount);
            if (imageRef.current?.files?.[0]) fd.append('file', imageRef.current.files[0]);

            await dreamFundService.createGoal(fd);
            setSuccess('Goal created! Awaiting admin approval.');
            setTitle(''); setDescription(''); setTargetAmount('');
            if (imageRef.current) imageRef.current.value = '';
            loadGoals();
            setTimeout(() => setView('list'), 1500);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to create goal');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUploadProof = async () => {
        setError(''); setSuccess('');
        if (!proofRef.current?.files?.[0]) {
            setError('Please select a proof image or video');
            return;
        }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('file', proofRef.current.files[0]);
            await dreamFundService.uploadProof(selectedGoal._id, fd);
            setSuccess('Proof uploaded! Awaiting admin verification.');
            loadGoals();
            setTimeout(() => setView('list'), 1500);
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to upload proof');
        } finally {
            setSubmitting(false);
        }
    };

    const modalStyle = {
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: 16,
    };

    const cardStyle = {
        background: 'linear-gradient(145deg, #1a0b2e, #0d0718)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24, padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)', maxHeight: '90vh', overflowY: 'auto',
    };

    const inputStyle = {
        width: '100%', padding: '12px 16px', borderRadius: 14, fontSize: 14, fontWeight: 600,
        background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
        color: '#fff', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
    };

    const labelStyle = {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5, display: 'block',
    };

    return (
        <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={cardStyle}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div>
                        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 20, margin: 0, letterSpacing: '-0.03em' }}>
                            🌟 Dream Fund Manager
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 0' }}>
                            {view === 'list' ? `${goals.length}/3 goals used` : view === 'create' ? 'Create new goal' : 'Upload proof'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {view !== 'list' && (
                            <button
                                onClick={() => { setView('list'); setError(''); setSuccess(''); }}
                                style={{ padding: '6px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                                ← Back
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✕</button>
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13, fontWeight: 600 }}>
                        ⚠️ {error}
                    </div>
                )}
                {success && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
                        ✅ {success}
                    </div>
                )}

                {/* ── List view ─────────────────────────────────────────── */}
                {view === 'list' && (
                    <>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
                        ) : goals.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>🌟</div>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>No goals yet. Create your first Dream Fund!</p>
                            </div>
                        ) : (
                            goals.map(g => {
                                const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                                const statusInfo = STATUS_LABEL[g.status] || { label: g.status, color: '#fff' };
                                return (
                                    <div key={g._id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0, flex: 1 }}>{g.title}</h4>
                                            <span style={{ color: statusInfo.color, fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{statusInfo.label}</span>
                                        </div>

                                        <div style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                                                <span>₹{g.currentAmount.toLocaleString('en-IN')} raised</span>
                                                <span>₹{g.targetAmount.toLocaleString('en-IN')} goal</span>
                                            </div>
                                            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
                                                <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #9333ea, #ec4899)', width: `${pct}%`, transition: 'width 0.5s ease' }} />
                                            </div>
                                        </div>

                                        {g.status === 'rejected' && g.rejectionReason && (
                                            <p style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>
                                                Reason: {g.rejectionReason}
                                            </p>
                                        )}

                                        {g.status === 'completed' && (
                                            <button
                                                onClick={() => { setSelectedGoal(g); setView('proof'); setError(''); setSuccess(''); }}
                                                style={{ marginTop: 8, padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                📎 Upload Proof
                                            </button>
                                        )}

                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                                                ❤️ {g.supporterCount || 0} supporters
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {goals.filter(g => ['pending','approved','completed','awaiting_verification'].includes(g.status)).length < 3 && (
                            <button
                                onClick={() => { setView('create'); setError(''); setSuccess(''); }}
                                style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #9333ea, #ec4899)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 8, transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(168,85,247,0.4)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                + Add Dream Fund Goal
                            </button>
                        )}
                    </>
                )}

                {/* ── Create view ───────────────────────────────────────── */}
                {view === 'create' && (
                    <div>
                        <label style={labelStyle}>Goal Title *</label>
                        <input
                            type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder='e.g. "Buy a new camera"' maxLength={120} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        />

                        <label style={labelStyle}>Target Amount (₹) *</label>
                        <input
                            type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                            placeholder="e.g. 50000" min={100} max={5000000} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        />

                        <label style={labelStyle}>Description</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Tell your fans what this goal means to you..."
                            maxLength={1000} rows={3}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => { e.target.style.borderColor = 'rgba(168,85,247,0.6)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                        />

                        <label style={labelStyle}>Goal Image (optional)</label>
                        <input
                            type="file" accept="image/*" ref={imageRef}
                            style={{ ...inputStyle, paddingTop: 10 }}
                        />

                        <button
                            onClick={handleCreate}
                            disabled={submitting}
                            style={{
                                width: '100%', height: 52, borderRadius: 16, border: 'none',
                                background: submitting ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #9333ea, #ec4899)',
                                color: submitting ? 'rgba(255,255,255,0.4)' : '#fff',
                                fontWeight: 800, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
                                marginTop: 4, transition: 'all 0.2s ease',
                            }}
                        >
                            {submitting ? 'Submitting…' : '🚀 Submit for Approval'}
                        </button>

                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
                            Goals require admin approval before appearing on your profile
                        </p>
                    </div>
                )}

                {/* ── Proof upload view ─────────────────────────────────── */}
                {view === 'proof' && selectedGoal && (
                    <div>
                        <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
                            <p style={{ color: '#a855f7', fontWeight: 700, fontSize: 13, margin: 0 }}>
                                Goal: {selectedGoal.title}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>
                                Raised ₹{selectedGoal.currentAmount.toLocaleString('en-IN')} of ₹{selectedGoal.targetAmount.toLocaleString('en-IN')}
                            </p>
                        </div>

                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                            Upload a photo or video as proof that you achieved your goal. This will be reviewed by admin before being publicly visible.
                        </p>

                        <label style={labelStyle}>Proof File (image or video, max 50MB)</label>
                        <input
                            type="file" accept="image/*,video/*" ref={proofRef}
                            style={{ ...inputStyle, paddingTop: 10 }}
                        />

                        <button
                            onClick={handleUploadProof}
                            disabled={submitting}
                            style={{
                                width: '100%', height: 52, borderRadius: 16, border: 'none',
                                background: submitting ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #9333ea, #ec4899)',
                                color: submitting ? 'rgba(255,255,255,0.4)' : '#fff',
                                fontWeight: 800, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
                                marginTop: 8, transition: 'all 0.2s ease',
                            }}
                        >
                            {submitting ? 'Uploading…' : '📎 Upload Proof'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
