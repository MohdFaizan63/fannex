import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * AlbumCarousel — Instagram-style swipe/arrow image carousel.
 *
 * Props:
 *  urls       – string[]  (array of media URLs)
 *  alt        – string    (alt text base)
 *  className  – string    (applied to wrapper)
 *  locked     – boolean   (blur images when locked)
 *  onImageClick – () => void (optional click handler)
 */
export default function AlbumCarousel({ urls = [], alt = '', className = '', locked = false, onImageClick }) {
    const [index, setIndex] = useState(0);
    const touchRef = useRef({ startX: 0, startY: 0 });
    const total = urls.length;

    // Clamp index when urls change
    useEffect(() => {
        if (index >= total) setIndex(Math.max(0, total - 1));
    }, [total, index]);

    const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
    const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

    const onTouchStart = (e) => {
        touchRef.current.startX = e.touches[0].clientX;
        touchRef.current.startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
        const dx = e.changedTouches[0].clientX - touchRef.current.startX;
        const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.startY);
        if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) {
            if (dx < 0) goNext();
            else goPrev();
        }
    };

    if (total === 0) return null;
    if (total === 1) {
        return (
            <div className={`relative overflow-hidden ${className}`} onClick={!locked ? onImageClick : undefined}>
                <img
                    src={urls[0]}
                    alt={alt}
                    loading="lazy"
                    className={`w-full h-full object-cover transition-all duration-500 ${locked ? 'blur-xl brightness-75 scale-110' : 'hover:scale-105'}`}
                />
            </div>
        );
    }

    return (
        <div
            className={`relative overflow-hidden select-none ${className}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Slide container */}
            <div
                className="flex transition-transform duration-300 ease-out h-full"
                style={{ transform: `translateX(-${index * 100}%)` }}
            >
                {urls.map((url, i) => (
                    <div key={i} className="w-full flex-shrink-0 h-full" onClick={!locked ? onImageClick : undefined}>
                        <img
                            src={url}
                            alt={`${alt} ${i + 1}`}
                            loading="lazy"
                            className={`w-full h-full object-cover ${locked ? 'blur-xl brightness-75 scale-110' : ''}`}
                        />
                    </div>
                ))}
            </div>

            {/* Counter badge */}
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs text-white/80 font-medium z-10">
                {index + 1} / {total}
            </div>

            {/* Album icon badge */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg z-10">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
            </div>

            {/* Prev arrow */}
            {index > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center hover:bg-white/15 transition-all"
                    aria-label="Previous"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Next arrow */}
            {index < total - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 text-white flex items-center justify-center hover:bg-white/15 transition-all"
                    aria-label="Next"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Dot indicators */}
            {total <= 10 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                    {urls.map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                            aria-label={`Go to ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
