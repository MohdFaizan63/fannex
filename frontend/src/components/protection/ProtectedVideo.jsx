/**
 * ProtectedVideo
 * ──────────────
 * A premium video player with:
 *  - No download button (controlsList="nodownload")
 *  - No right-click save
 *  - Watermark overlay
 *  - Auto-pause when tab is hidden or suspicious activity detected
 *  - Blur overlay on screenshot attempt
 *
 * Props:
 *   src      — video URL (ideally a signed URL from your backend)
 *   poster   — optional thumbnail URL
 *   viewer   — { _id, username, email }
 *   style    — optional container style
 */
import { useRef, useEffect } from 'react';
import ContentWatermark from './ContentWatermark';
import useContentProtection from '../../hooks/useContentProtection';

export default function ProtectedVideo({ src, poster, viewer, style }) {
    const videoRef = useRef(null);
    const { blurred, warningMsg } = useContentProtection({ userId: viewer?._id, enabled: true });

    // Auto-pause when blurred (tab switch, screenshot attempt, devtools)
    useEffect(() => {
        if (blurred && videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
        }
    }, [blurred]);

    // Auto-pause on visibility change separately (belt & suspenders)
    useEffect(() => {
        const onHide = () => { if (videoRef.current) videoRef.current.pause(); };
        document.addEventListener('visibilitychange', onHide);
        return () => document.removeEventListener('visibilitychange', onHide);
    }, []);

    return (
        <div
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 12,
                background: '#000',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                ...style,
            }}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Video element */}
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                controls
                playsInline
                controlsList="nodownload nofullscreen"
                disablePictureInPicture
                style={{
                    width: '100%',
                    display: 'block',
                    filter: blurred ? 'blur(24px) brightness(0.3)' : 'none',
                    transition: 'filter 0.3s ease',
                }}
                onContextMenu={e => e.preventDefault()}
            />

            {/* Watermark */}
            {viewer && !blurred && (
                <ContentWatermark
                    username={viewer.username || viewer.name}
                    userId={viewer._id}
                    email={viewer.email}
                    opacity={0.18}
                />
            )}

            {/* Blur warning */}
            {blurred && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 40, pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        padding: '18px 28px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>⏸️</div>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>
                            {warningMsg || 'Content paused'}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '6px 0 0' }}>
                            Switch back to resume playback
                        </p>
                    </div>
                </div>
            )}

            {/* Intercept overlay — blocks right-click on video area */}
            <div
                style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'transparent' }}
                onContextMenu={e => e.preventDefault()}
                onDragStart={e => e.preventDefault()}
            />
        </div>
    );
}
