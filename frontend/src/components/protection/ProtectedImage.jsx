/**
 * ProtectedImage
 * ──────────────
 * Drop-in replacement for <img> for premium content.
 * Wraps the image with a ContentWatermark and blur overlay.
 *
 * Props:
 *   src, alt, style — standard image props
 *   viewer          — { _id, username, email } of the logged-in fan
 *   className       — optional container className
 */
import { useRef } from 'react';
import ContentWatermark from './ContentWatermark';
import useContentProtection from '../../hooks/useContentProtection';

export default function ProtectedImage({ src, alt, style, className, viewer }) {
    const { blurred, warningMsg } = useContentProtection({ userId: viewer?._id, enabled: true });
    const containerRef = useRef(null);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'inline-block',
                width: '100%',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                ...style,
            }}
            onContextMenu={e => e.preventDefault()}
            onDragStart={e => e.preventDefault()}
        >
            {/* The actual image */}
            <img
                src={src}
                alt={alt || 'Premium content'}
                draggable={false}
                style={{
                    width: '100%',
                    display: 'block',
                    filter: blurred ? 'blur(20px) brightness(0.4)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: 'none',
                    WebkitUserDrag: 'none',
                    pointerEvents: 'none',  // prevents drag-to-save on most browsers
                }}
                onContextMenu={e => e.preventDefault()}
            />

            {/* Watermark overlay */}
            {viewer && !blurred && (
                <ContentWatermark
                    username={viewer.username || viewer.name}
                    userId={viewer._id}
                    email={viewer.email}
                />
            )}

            {/* Blur warning banner */}
            {blurred && warningMsg && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    zIndex: 40,
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.75)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 16,
                        padding: '16px 24px',
                        textAlign: 'center',
                        maxWidth: 280,
                    }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{warningMsg}</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '6px 0 0' }}>
                            All activity is monitored and watermarked
                        </p>
                    </div>
                </div>
            )}

            {/* Transparent overlay — blocks direct right-click on image */}
            <div
                style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'transparent' }}
                onContextMenu={e => e.preventDefault()}
                onDragStart={e => e.preventDefault()}
            />
        </div>
    );
}
