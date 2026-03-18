/**
 * ProtectedContentArea
 * ─────────────────────
 * Wraps a section of premium content (e.g., a feed or post) with:
 *  - Global screenshot / right-click / PrintScreen detection
 *  - Blur overlay with warning message
 *  - Semi-transparent warning banner at the top (non-intrusive)
 *
 * Usage:
 *   <ProtectedContentArea viewer={user}>
 *     <ProtectedImage src={...} viewer={user} />
 *     <ProtectedVideo src={...} viewer={user} />
 *   </ProtectedContentArea>
 */
import useContentProtection from '../../hooks/useContentProtection';

export default function ProtectedContentArea({ children, viewer }) {
    const { blurred, warningMsg } = useContentProtection({
        userId: viewer?._id,
        enabled: !!viewer,
    });

    return (
        <div
            style={{ position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' }}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Informational top banner (subtle, always visible) */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.15)',
                borderRadius: 10,
                marginBottom: 12,
            }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.7)" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    Content is watermarked and protected · Screenshots are tracked
                </span>
            </div>

            {/* Content */}
            <div style={{
                filter: blurred ? 'blur(16px) brightness(0.3)' : 'none',
                transition: 'filter 0.3s ease',
                pointerEvents: blurred ? 'none' : 'auto',
            }}>
                {children}
            </div>

            {/* Full-area blur warning overlay */}
            {blurred && warningMsg && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.82)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 20,
                        padding: '20px 32px',
                        textAlign: 'center',
                        maxWidth: 320,
                    }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
                        <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>
                            {warningMsg}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
                            All activity is watermarked and logged for leak tracing
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
