import { useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { getErrorMessage } from '../utils/helpers';

// ─── Draggable Image Repositioner ─────────────────────────────────────────────
function DraggableImage({ src, position, setPosition, height, shape = 'rect', label }) {
    const containerRef = useRef(null);
    const dragging = useRef(false);
    const startY = useRef(0);
    const startPos = useRef(50);

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        dragging.current = true;
        startY.current = e.clientY;
        startPos.current = position;
        containerRef.current?.setPointerCapture?.(e.pointerId);
    }, [position]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const deltaY = e.clientY - startY.current;
        const pctDelta = (deltaY / rect.height) * 100;
        const newPos = Math.max(0, Math.min(100, startPos.current - pctDelta));
        setPosition(newPos);
    }, [setPosition]);

    const handlePointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    const isCircle = shape === 'circle';

    return (
        <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing ${isCircle ? 'rounded-full' : 'rounded-xl'} border-2 border-surface-600 hover:border-brand-500/60 transition-colors`}
            style={{ height, width: isCircle ? height : undefined }}
        >
            <img
                src={src}
                alt={label}
                draggable={false}
                className="absolute inset-x-0 w-full pointer-events-none"
                style={{
                    height: '200%',
                    objectFit: 'cover',
                    top: `${-(position / 100) * 100}%`,
                }}
            />
            {/* Drag hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Drag to reposition
                </span>
            </div>
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function EditCreatorProfileModal({ profile, onClose, onSaved }) {
    const [bio, setBio] = useState(profile?.bio || '');
    const [displayName, setDisplay] = useState(profile?.displayName || '');
    const [subPrice, setSubPrice] = useState(Math.max(0.1, profile?.subscriptionPrice ?? 199));
    const [profileFile, setProfileFile] = useState(null);
    const [bannerFile, setBannerFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);
    const [coverPos, setCoverPos] = useState(profile?.coverImagePosition ?? 50);
    const [profilePos, setProfilePos] = useState(profile?.profileImagePosition ?? 50);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const profileRef = useRef();
    const bannerRef = useRef();

    const handleProfileFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setProfileFile(f);
        setProfilePreview(URL.createObjectURL(f));
        setProfilePos(50); // reset position for new image
    };

    const handleBannerFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBannerFile(f);
        setBannerPreview(URL.createObjectURL(f));
        setCoverPos(50); // reset position for new image
    };

    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            const fd = new FormData();
            if (bio !== profile?.bio) fd.append('bio', bio);
            if (displayName !== profile?.displayName) fd.append('displayName', displayName);
            if (profileFile) fd.append('profileImage', profileFile);
            if (bannerFile) fd.append('bannerImage', bannerFile);
            fd.append('coverImagePosition', Math.round(coverPos));
            fd.append('profileImagePosition', Math.round(profilePos));
            fd.append('subscriptionPrice', subPrice);

            const { data } = await api.patch('/creator/profile', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            onSaved(data.data);
            onClose();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const bannerSrc = bannerPreview || profile?.coverImage;
    const profileSrc = profilePreview || profile?.profileImage;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="glass rounded-2xl border border-white/10 w-full max-w-lg p-6 animate-fade-in-up shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-black text-white">Edit Profile</h2>
                    <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-col gap-4">

                    {/* ── Banner ─────────────────────────────────────────────── */}
                    <div>
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Cover / Banner Image</p>
                        {bannerSrc ? (
                            <div className="flex flex-col gap-2">
                                <DraggableImage
                                    src={bannerSrc}
                                    position={coverPos}
                                    setPosition={setCoverPos}
                                    height="140px"
                                    label="banner"
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-surface-400">↕ Drag image to reposition</span>
                                    <button
                                        type="button"
                                        onClick={() => bannerRef.current?.click()}
                                        className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                                    >
                                        Change image
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => bannerRef.current?.click()}
                                className="relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-surface-600 hover:border-brand-500/60 transition-all group"
                                style={{ height: '120px' }}
                            >
                                <div className="flex flex-col items-center justify-center h-full text-surface-500">
                                    <span className="text-3xl mb-1">📷</span>
                                    <span className="text-xs">Click to upload</span>
                                </div>
                            </div>
                        )}
                        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerFile} />
                    </div>

                    {/* ── Profile picture ─────────────────────────────────────── */}
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            {profileSrc ? (
                                <DraggableImage
                                    src={profileSrc}
                                    position={profilePos}
                                    setPosition={setProfilePos}
                                    height="80px"
                                    shape="circle"
                                    label="profile"
                                />
                            ) : (
                                <div
                                    onClick={() => profileRef.current?.click()}
                                    className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-surface-600 hover:border-brand-500/60 transition-all flex-shrink-0 group"
                                >
                                    <div className="w-full h-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold">
                                        {displayName?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                                        <span className="text-white text-xs">✏️</span>
                                    </div>
                                </div>
                            )}
                            {profileSrc && (
                                <button
                                    type="button"
                                    onClick={() => profileRef.current?.click()}
                                    className="text-[10px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                        <input ref={profileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleProfileFile} />
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Display Name</p>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplay(e.target.value)}
                                maxLength={50}
                                placeholder="Your creator name"
                                className="input-dark w-full"
                            />
                        </div>
                    </div>

                    {/* ── Bio ─────────────────────────────────────────────────── */}
                    <div>
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Bio</p>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            maxLength={300}
                            placeholder="Tell your fans about yourself…"
                            className="input-dark w-full resize-none"
                        />
                        <p className="text-xs text-surface-400 mt-1 text-right">{bio.length}/300</p>
                    </div>

                    {/* ── Subscription Price ───────────────────────────────────── */}
                    <div>
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Subscription Price</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {[99, 149, 199, 299, 499].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setSubPrice(p)}
                                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${subPrice === p
                                        ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                                        : 'border-surface-600 text-surface-400 hover:border-surface-400'
                                        }`}
                                >
                                    ₹{p}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-surface-400 text-sm">Custom:</span>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">₹</span>
                                <input
                                    type="number"
                                    value={subPrice}
                                    onChange={(e) => setSubPrice(Math.max(0.1, Number(e.target.value)))}
                                    min={0.1}
                                    step={0.1}
                                    max={99999}
                                    className="input-dark w-full pl-7"
                                    placeholder="Enter price"
                                />
                            </div>
                            <span className="text-surface-300 text-xs">/month</span>
                        </div>
                        <p className="text-xs text-surface-400 mt-1.5">
                            Current: ₹{profile?.subscriptionPrice ?? 199}/mo · Existing subscribers keep their current rate.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-1">
                        <button onClick={onClose} className="btn-outline flex-1 py-2.5 text-sm">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-brand flex-1 py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {saving
                                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                                : '✓ Save Changes'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
