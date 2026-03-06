import { useState, useRef, useEffect, useCallback } from 'react';

// ── Format seconds → mm:ss ──────────────────────────────────────────────────
const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Premium custom HTML5 video player
 *
 * Props:
 *  src        – video URL
 *  poster     – optional poster image
 *  autoPlay   – default false
 *  className  – container classes
 */
export default function VideoPlayer({ src, poster, autoPlay = false, className = '' }) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const seekRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const hideTimer = useRef(null);

    const v = videoRef.current;

    // ── Play / Pause ────────────────────────────────────────────────────────
    const togglePlay = useCallback(() => {
        if (!v) return;
        if (v.paused) { v.play(); setPlaying(true); }
        else { v.pause(); setPlaying(false); }
    }, [v]);

    // ── Volume ──────────────────────────────────────────────────────────────
    const changeVolume = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (v) { v.volume = val; setMuted(val === 0); }
    };

    const toggleMute = () => {
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    };

    // ── Seek ────────────────────────────────────────────────────────────────
    const handleSeek = (e) => {
        if (!v || !duration) return;
        const rect = seekRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        v.currentTime = pct * duration;
    };

    // ── Fullscreen ──────────────────────────────────────────────────────────
    const toggleFullscreen = async () => {
        const el = containerRef.current;
        if (!el) return;
        try {
            if (!document.fullscreenElement) {
                await el.requestFullscreen();
                setFullscreen(true);
            } else {
                await document.exitFullscreen();
                setFullscreen(false);
            }
        } catch (_) { }
    };

    // ── Auto-hide controls ──────────────────────────────────────────────────
    const resetHideTimer = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        if (playing) {
            hideTimer.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [playing]);

    // ── Video event listeners ───────────────────────────────────────────────
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;

        const onMeta = () => { setDuration(vid.duration); setLoading(false); };
        const onTime = () => setCurrent(vid.currentTime);
        const onBuf = () => {
            if (vid.buffered.length > 0) setBuffered(vid.buffered.end(vid.buffered.length - 1));
        };
        const onWaiting = () => setLoading(true);
        const onCanPlay = () => setLoading(false);
        const onEnded = () => setPlaying(false);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);

        vid.addEventListener('loadedmetadata', onMeta);
        vid.addEventListener('timeupdate', onTime);
        vid.addEventListener('progress', onBuf);
        vid.addEventListener('waiting', onWaiting);
        vid.addEventListener('canplay', onCanPlay);
        vid.addEventListener('ended', onEnded);
        vid.addEventListener('play', onPlay);
        vid.addEventListener('pause', onPause);

        return () => {
            vid.removeEventListener('loadedmetadata', onMeta);
            vid.removeEventListener('timeupdate', onTime);
            vid.removeEventListener('progress', onBuf);
            vid.removeEventListener('waiting', onWaiting);
            vid.removeEventListener('canplay', onCanPlay);
            vid.removeEventListener('ended', onEnded);
            vid.removeEventListener('play', onPlay);
            vid.removeEventListener('pause', onPause);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key) {
                case ' ': case 'k': e.preventDefault(); togglePlay(); break;
                case 'f': e.preventDefault(); toggleFullscreen(); break;
                case 'm': e.preventDefault(); toggleMute(); break;
                case 'ArrowRight': e.preventDefault(); if (v) v.currentTime += 5; break;
                case 'ArrowLeft': e.preventDefault(); if (v) v.currentTime -= 5; break;
                case 'ArrowUp': e.preventDefault(); if (v) v.volume = Math.min(1, v.volume + 0.1); setVolume(v?.volume ?? 1); break;
                case 'ArrowDown': e.preventDefault(); if (v) v.volume = Math.max(0, v.volume - 0.1); setVolume(v?.volume ?? 0); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [togglePlay, v]);

    useEffect(() => { resetHideTimer(); }, [playing, resetHideTimer]);

    // Auto-play on mount if requested
    useEffect(() => {
        if (autoPlay && v) { v.play().catch(() => { }); }
    }, [autoPlay, v]);

    const pctPlayed = duration ? (current / duration) * 100 : 0;
    const pctBuffered = duration ? (buffered / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            onMouseMove={resetHideTimer}
            onMouseLeave={() => playing && setShowControls(false)}
            onClick={togglePlay}
            className={`relative bg-black overflow-hidden group select-none ${className}`}
            style={{ cursor: showControls ? 'default' : 'none' }}
        >
            {/* ── Video element ───────────────────────────────────────────── */}
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                preload="metadata"
                playsInline
                className="w-full h-full object-contain"
            />

            {/* ── Loading spinner ─────────────────────────────────────────── */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full border-3 border-white/20 border-t-white animate-spin" />
                </div>
            )}

            {/* ── Big play button (paused) ────────────────────────────────── */}
            {!playing && !loading && showControls && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110">
                        <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* ── Controls overlay ────────────────────────────────────────── */}
            <div
                className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pt-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Seek bar ────────────────────────────────────────────── */}
                <div
                    ref={seekRef}
                    onClick={handleSeek}
                    className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/seek mb-3 hover:h-2.5 transition-all"
                >
                    {/* Buffered */}
                    <div className="absolute inset-y-0 left-0 bg-white/15 rounded-full" style={{ width: `${pctBuffered}%` }} />
                    {/* Played */}
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{
                        width: `${pctPlayed}%`,
                        background: 'linear-gradient(90deg, #cc52b8, #7c3aed)',
                    }} />
                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg shadow-black/30 opacity-0 group-hover/seek:opacity-100 transition-opacity"
                        style={{ left: `${pctPlayed}%`, transform: 'translate(-50%, -50%)' }}
                    />
                </div>

                {/* ── Bottom row ───────────────────────────────────────────── */}
                <div className="flex items-center gap-3 text-white">
                    {/* Play / Pause */}
                    <button onClick={togglePlay} className="hover:scale-110 transition-transform">
                        {playing ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    {/* Time */}
                    <span className="text-xs font-mono text-white/80 min-w-[5rem]">
                        {fmt(current)} / {fmt(duration)}
                    </span>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Volume */}
                    <div className="flex items-center gap-1.5 group/vol">
                        <button onClick={toggleMute} className="hover:scale-110 transition-transform">
                            {muted || volume === 0 ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={muted ? 0 : volume}
                            onChange={changeVolume}
                            className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-brand-500 cursor-pointer h-1"
                        />
                    </div>

                    {/* Fullscreen */}
                    <button onClick={toggleFullscreen} className="hover:scale-110 transition-transform">
                        {fullscreen ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
