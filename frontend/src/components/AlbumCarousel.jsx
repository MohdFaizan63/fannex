import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * AlbumCarousel — clean swipe carousel for post albums.
 * No visible arrows by default — swipe or tap left/right thirds to navigate.
 * Dot indicators show current position.
 */
export default function AlbumCarousel({ urls = [], alt = '', className = '', locked = false, onImageClick }) {
    const [index, setIndex] = useState(0);
    const containerRef = useRef(null);
    const tx0 = useRef(null);
    const ty0 = useRef(null);
    const total = urls.length;

    useEffect(() => {
        if (index >= total) setIndex(Math.max(0, total - 1));
    }, [total, index]);

    const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
    const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

    // Non-passive touchmove to prevent scroll jitter during horizontal swipe
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = (e) => {
            if (tx0.current === null) return;
            const dx = Math.abs(e.touches[0].clientX - tx0.current);
            const dy = Math.abs(e.touches[0].clientY - ty0.current);
            if (dx > dy && dx > 8) e.preventDefault();
        };
        el.addEventListener('touchmove', handler, { passive: false });
        return () => el.removeEventListener('touchmove', handler);
    }, []);

    const onTouchStart = (e) => {
        tx0.current = e.touches[0].clientX;
        ty0.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
        if (tx0.current === null) return;
        const dx = e.changedTouches[0].clientX - tx0.current;
        const dy = Math.abs(e.changedTouches[0].clientY - ty0.current);
        if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
            dx < 0 ? goNext() : goPrev();
        }
        tx0.current = null;
    };

    if (total === 0) return null;
    if (total === 1) {
        return (
            <div className={`relative overflow-hidden ${className}`} onClick={!locked ? onImageClick : undefined}>
                <img
                    src={urls[0]}
                    alt={alt}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-transform duration-500 ${locked ? 'blur-xl brightness-75 scale-110' : 'hover:scale-105'}`}
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden select-none ${className}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Slide strip */}
            <div
                className="flex h-full"
                style={{
                    transform: `translateX(-${index * 100}%)`,
                    transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                    willChange: 'transform',
                }}
            >
                {urls.map((url, i) => (
                    <div key={i} className="w-full flex-shrink-0 h-full" onClick={!locked ? onImageClick : undefined}>
                        <img
                            src={url}
                            alt={`${alt} ${i + 1}`}
                            loading="lazy"
                            className={`w-full h-full object-cover ${locked ? 'blur-xl brightness-75 scale-110' : ''}`}
                            style={{ willChange: 'transform' }}
                        />
                    </div>
                ))}
            </div>


            {/* Invisible prev/next tap zones (left/right thirds) */}
            {index > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
                    style={{ background: 'transparent' }}
                    aria-label="Previous"
                />
            )}
            {index < total - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
                    style={{ background: 'transparent' }}
                    aria-label="Next"
                />
            )}

            {/* Pill dot indicators — bottom center */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1">
                {urls.map((_, i) => (
                    <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                        aria-label={`Slide ${i + 1}`}
                        style={{
                            width: i === index ? 16 : 5,
                            height: 5,
                            borderRadius: 999,
                            background: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                            transition: 'width 0.22s ease, background 0.2s ease',
                            padding: 0,
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
