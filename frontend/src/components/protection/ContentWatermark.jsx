/**
 * ContentWatermark
 * ────────────────
 * Renders a semi-transparent, slowly drifting watermark over premium content.
 * Props:
 *   username  — fan's username shown in watermark
 *   userId    — fan's user ID (last 8 chars shown for brevity)
 *   email     — optional masked email (e.g. "j***@gmail.com")
 *   opacity   — 0-1, default 0.14
 */
import { useEffect, useState, useRef } from 'react';

function maskEmail(email) {
    if (!email) return null;
    const [local, domain] = email.split('@');
    return `${local[0]}***@${domain}`;
}

export default function ContentWatermark({ username, userId, email, opacity = 0.14 }) {
    const [timestamp, setTimestamp] = useState(() => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    const [pos, setPos] = useState({ top: '15%', left: '10%' });
    const intervalRef = useRef(null);
    const tsRef = useRef(null);

    // Update position every 8 seconds — anti-crop
    const randomPos = () => ({
        top:  `${10 + Math.random() * 60}%`,
        left: `${5  + Math.random() * 55}%`,
    });

    useEffect(() => {
        intervalRef.current = setInterval(() => setPos(randomPos()), 8000);
        tsRef.current = setInterval(() => {
            setTimestamp(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        }, 60_000);
        return () => {
            clearInterval(intervalRef.current);
            clearInterval(tsRef.current);
        };
    }, []);

    const shortId = userId ? userId.toString().slice(-8) : '';
    const maskedEmail = maskEmail(email);

    return (
        <>
            <style>{`
                @keyframes wmDrift {
                    0%   { transform: rotate(-18deg) scale(1);   }
                    50%  { transform: rotate(-18deg) scale(1.02) translateY(-3px); }
                    100% { transform: rotate(-18deg) scale(1);   }
                }
                .wm-text {
                    animation: wmDrift 6s ease-in-out infinite;
                    transition: top 2s ease, left 2s ease;
                }
            `}</style>

            {/* Primary diagonal watermark */}
            <div
                className="wm-text"
                style={{
                    position: 'absolute',
                    top: pos.top,
                    left: pos.left,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 30,
                    textAlign: 'center',
                    transition: 'top 2s ease, left 2s ease',
                }}
            >
                <div style={{
                    color: `rgba(255,255,255,${opacity})`,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    lineHeight: 1.7,
                    textShadow: `0 0 8px rgba(0,0,0,0.6)`,
                    transform: 'rotate(-20deg)',
                    whiteSpace: 'nowrap',
                }}>
                    <div>@{username}</div>
                    <div style={{ fontSize: 11 }}>ID: {shortId}</div>
                    {maskedEmail && <div style={{ fontSize: 10 }}>{maskedEmail}</div>}
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{timestamp}</div>
                </div>
            </div>

            {/* Secondary faint watermark — opposite corner for redundancy */}
            <div style={{
                position: 'absolute',
                bottom: '8%',
                right: '5%',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 30,
                color: `rgba(255,255,255,${opacity * 0.6})`,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'monospace',
                lineHeight: 1.6,
                textShadow: `0 0 6px rgba(0,0,0,0.5)`,
                transform: 'rotate(-20deg)',
                whiteSpace: 'nowrap',
                textAlign: 'center',
            }}>
                <div>@{username}</div>
                <div>Fannex · {shortId}</div>
            </div>
        </>
    );
}
