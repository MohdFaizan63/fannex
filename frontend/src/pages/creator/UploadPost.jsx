import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../services/api';
import Input from '../../components/Input';
import { getErrorMessage } from '../../utils/helpers';

// ── Constants ──────────────────────────────────────────────────────────────────
const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/gif';
const ACCEPTED_VIDEO = 'video/mp4,video/quicktime,video/webm';
const ACCEPTED_ALL = `${ACCEPTED_IMAGES},${ACCEPTED_VIDEO}`;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;
const MAX_FILES = 10;

export default function UploadPost() {
    const navigate = useNavigate();
    const fileRef = useRef(null);

    const [files, setFiles] = useState([]);         // { file, preview, id }[]
    const [mode, setMode] = useState(null);          // null | 'image' | 'video'
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [dragIdx, setDragIdx] = useState(null);    // drag-to-reorder

    const { register, handleSubmit, formState: { errors } } = useForm({
        defaultValues: { isLocked: false },
    });

    // ── Add files ──────────────────────────────────────────────────────────────
    const addFiles = useCallback((newFiles) => {
        setError('');
        const incoming = Array.from(newFiles);
        if (incoming.length === 0) return;

        // Detect type of first file to decide mode
        const firstType = incoming[0].type;
        const isVideo = VIDEO_TYPES.includes(firstType);
        const isImage = IMAGE_TYPES.includes(firstType);

        if (!isVideo && !isImage) {
            setError('Unsupported file type.');
            return;
        }

        // Video: only 1, no mixing
        if (isVideo) {
            if (incoming.length > 1 || files.length > 0) {
                setError('Video posts can only contain a single video.');
                return;
            }
            if (incoming[0].size > MAX_VIDEO_MB * 1_000_000) {
                setError(`Video must be under ${MAX_VIDEO_MB}MB`);
                return;
            }
            setMode('video');
            setFiles([{ file: incoming[0], preview: null, id: Date.now() }]);
            return;
        }

        // If we already have a video, don't allow images
        if (mode === 'video') {
            setError('Cannot mix images and videos in a single post.');
            return;
        }

        // Validate each image
        const valid = [];
        for (const f of incoming) {
            if (!IMAGE_TYPES.includes(f.type)) {
                setError(`Skipped "${f.name}" — unsupported type.`);
                continue;
            }
            if (f.size > MAX_IMAGE_MB * 1_000_000) {
                setError(`"${f.name}" exceeds ${MAX_IMAGE_MB}MB limit.`);
                continue;
            }
            valid.push(f);
        }

        const combined = [...files, ...valid.map((f) => ({
            file: f,
            preview: URL.createObjectURL(f),
            id: Date.now() + Math.random(),
        }))];

        if (combined.length > MAX_FILES) {
            setError(`Maximum ${MAX_FILES} photos per album.`);
            setFiles(combined.slice(0, MAX_FILES));
        } else {
            setFiles(combined);
        }
        setMode('image');
    }, [files, mode]);

    // ── Remove file ────────────────────────────────────────────────────────────
    const removeFile = (id) => {
        setFiles((prev) => {
            const filtered = prev.filter((f) => f.id !== id);
            if (filtered.length === 0) setMode(null);
            return filtered;
        });
    };

    // ── Drag & drop to upload area ─────────────────────────────────────────────
    const onDropUpload = (e) => {
        e.preventDefault();
        setDragOver(false);
        addFiles(e.dataTransfer.files);
    };

    // ── Drag-to-reorder thumbnails ─────────────────────────────────────────────
    const onDragStartReorder = (idx) => setDragIdx(idx);

    const onDropReorder = (targetIdx) => {
        if (dragIdx === null || dragIdx === targetIdx) return;
        setFiles((prev) => {
            const copy = [...prev];
            const [moved] = copy.splice(dragIdx, 1);
            copy.splice(targetIdx, 0, moved);
            return copy;
        });
        setDragIdx(null);
    };

    // ── File input change ──────────────────────────────────────────────────────
    const handleFileInput = (e) => addFiles(e.target.files);

    // ── Submit ─────────────────────────────────────────────────────────────────
    const onSubmit = async (data) => {
        if (files.length === 0) {
            setError('Please select at least one media file.');
            return;
        }
        setError('');
        setUploading(true);
        setProgress(0);

        const fd = new FormData();
        files.forEach((f) => fd.append('media', f.file));
        if (data.caption?.trim()) fd.append('caption', data.caption.trim());
        fd.append('isLocked', data.isLocked ? 'true' : 'false');

        try {
            await api.post('/posts', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (evt) => {
                    const pct = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
                    setProgress(pct);
                },
            });
            navigate('/dashboard');
        } catch (err) {
            setError(getErrorMessage(err));
            setUploading(false);
            setProgress(0);
        }
    };

    const totalSizeMB = files.reduce((s, f) => s + f.file.size, 0) / 1_000_000;

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-3xl font-black text-white mb-2">Upload Post</h1>
            <p style={{ color: 'rgba(255,255,255,0.42)' }} className="mb-6">Share exclusive content with your subscribers.</p>

            {/* Size limits info */}
            <div className="flex items-center gap-4 text-xs text-surface-500 mb-6">
                <span className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg border border-white/5">
                    📷 Photos: {MAX_IMAGE_MB}MB each · up to {MAX_FILES}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg border border-white/5">
                    🎬 Videos: {MAX_VIDEO_MB}MB · 1 per post
                </span>
            </div>

            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

                {/* ── Drop / Click zone ───────────────────────────────────────── */}
                <div
                    onClick={() => !uploading && fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDropUpload}
                    className={`glass rounded-2xl border-2 border-dashed flex flex-col items-center justify-center min-h-44 p-8 transition-all
                        ${uploading ? 'cursor-not-allowed opacity-60'
                            : dragOver ? 'border-brand-500 bg-brand-500/5 cursor-copy'
                                : files.length > 0 ? 'border-brand-500/60 hover:border-brand-500 cursor-pointer'
                                    : 'border-surface-600 hover:border-brand-500/50 cursor-pointer'
                        }`}
                >
                    {files.length === 0 ? (
                        <>
                            <div className="text-5xl mb-4 opacity-40">📤</div>
                            <p className="text-white font-medium">Click or drag to upload</p>
                            <p className="text-xs text-surface-500 mt-1">JPEG · PNG · WebP · GIF · MP4 · MOV · WebM</p>
                            <p className="text-xs text-surface-600 mt-0.5">Drop multiple photos for an album post</p>
                        </>
                    ) : mode === 'video' ? (
                        <>
                            <div className="text-6xl mb-3">🎬</div>
                            <p className="text-brand-400 font-semibold">{files[0].file.name}</p>
                            <p className="text-xs text-surface-500 mt-1">{(files[0].file.size / 1_000_000).toFixed(1)} MB · video</p>
                        </>
                    ) : (
                        <p className="text-surface-400 text-sm">
                            {files.length} photo{files.length !== 1 ? 's' : ''} selected · {totalSizeMB.toFixed(1)} MB
                            {files.length < MAX_FILES && <span className="text-surface-600"> · click to add more</span>}
                        </p>
                    )}

                    <input
                        ref={fileRef}
                        type="file"
                        accept={mode === 'video' ? ACCEPTED_VIDEO : mode === 'image' ? ACCEPTED_IMAGES : ACCEPTED_ALL}
                        onChange={handleFileInput}
                        className="hidden"
                        disabled={uploading}
                        multiple={mode !== 'video'}
                    />
                </div>

                {/* ── Thumbnail grid (drag-to-reorder) ────────────────────────── */}
                {mode === 'image' && files.length > 0 && (
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                        {files.map((f, i) => (
                            <div
                                key={f.id}
                                draggable={!uploading}
                                onDragStart={() => onDragStartReorder(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); onDropReorder(i); }}
                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing group ${dragIdx === i ? 'border-brand-500 opacity-50 scale-95' : 'border-white/5 hover:border-brand-500/40'
                                    }`}
                            >
                                <img src={f.preview} alt="" className="w-full h-full object-cover" />
                                {/* Order badge */}
                                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center font-bold">
                                    {i + 1}
                                </div>
                                {/* Remove button */}
                                {!uploading && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Change / Add more */}
                {files.length > 0 && !uploading && (
                    <div className="flex items-center gap-3 -mt-3">
                        {mode === 'image' && files.length < MAX_FILES && (
                            <button type="button" onClick={() => fileRef.current?.click()}
                                className="text-xs text-brand-400 hover:text-brand-300">
                                + Add more photos
                            </button>
                        )}
                        <button type="button" onClick={() => { setFiles([]); setMode(null); setError(''); }}
                            className="text-xs text-surface-500 hover:text-red-400 transition-colors">
                            Clear all
                        </button>
                    </div>
                )}

                {/* ── Upload progress ─────────────────────────────────────────── */}
                {uploading && (
                    <div className="space-y-2">
                        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${progress}%`,
                                    background: 'linear-gradient(90deg, #cc52b8, #7c3aed)',
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs text-surface-400">
                            <span>Uploading{files.length > 1 ? ` ${files.length} files` : ''}…</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                )}

                {/* ── Caption ─────────────────────────────────────────────────── */}
                <Input
                    label="Caption (optional)"
                    placeholder="Write something about this post…"
                    error={errors.caption?.message}
                    {...register('caption', { maxLength: { value: 2000, message: 'Max 2000 characters' } })}
                />

                {/* ── Locked toggle ───────────────────────────────────────────── */}
                <label className="flex items-center gap-4 glass rounded-xl px-5 py-4 cursor-pointer border transition-all border-surface-700 hover:border-brand-500/40">
                    <input
                        type="checkbox"
                        className="w-5 h-5 rounded accent-brand-500 cursor-pointer"
                        {...register('isLocked')}
                        disabled={uploading}
                    />
                    <div>
                        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                            🔒 Subscribers only
                        </p>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Only fans with an active subscription can view this post
                        </p>
                    </div>
                </label>

                {/* ── Submit ──────────────────────────────────────────────────── */}
                <button
                    type="submit"
                    disabled={uploading || files.length === 0}
                    className="btn-brand w-full py-3 text-base relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading
                        ? <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Uploading {progress}%
                        </span>
                        : files.length > 1
                            ? `📤 Publish Album (${files.length} photos)`
                            : '📤 Publish Post'
                    }
                </button>
            </form>
        </div>
    );
}
