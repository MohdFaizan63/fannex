/**
 * Pagination — reusable page navigation component.
 *
 * Props:
 *   currentPage  {number}   — 1-indexed current page
 *   totalPages   {number}   — total number of pages
 *   onPageChange {Function} — called with the new page number
 *   className    {string}   — optional wrapper class override
 *
 * Usage:
 *   <Pagination
 *     currentPage={page}
 *     totalPages={totalPages}
 *     onPageChange={(p) => setPage(p)}
 *   />
 */
export default function Pagination({ currentPage, totalPages, onPageChange, className = '' }) {
    if (totalPages <= 1) return null;

    // Build page window — always show first, last, and up to 5 around current
    const pages = buildPageWindow(currentPage, totalPages);

    return (
        <nav
            aria-label="Pagination"
            className={`flex items-center justify-center gap-1.5 ${className}`}
        >
            {/* ← Prev */}
            <PageButton
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
            >
                ←
            </PageButton>

            {/* Page numbers with ellipsis */}
            {pages.map((p, i) =>
                p === '...' ? (
                    <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-surface-600 text-sm select-none">
                        …
                    </span>
                ) : (
                    <PageButton
                        key={p}
                        onClick={() => p !== currentPage && onPageChange(p)}
                        active={p === currentPage}
                        aria-label={`Page ${p}`}
                        aria-current={p === currentPage ? 'page' : undefined}
                    >
                        {p}
                    </PageButton>
                )
            )}

            {/* Next → */}
            <PageButton
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
            >
                →
            </PageButton>
        </nav>
    );
}

// ── Button variants ───────────────────────────────────────────────────────────
function PageButton({ children, onClick, disabled, active, ...rest }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                'w-9 h-9 rounded-xl text-sm font-medium transition-all select-none',
                active
                    ? 'btn-brand cursor-default'
                    : disabled
                        ? 'glass text-surface-600 cursor-not-allowed opacity-40'
                        : 'glass text-surface-300 hover:text-white hover:bg-white/10 border border-white/10 hover:border-brand-500/40',
            ].join(' ')}
            {...rest}
        >
            {children}
        </button>
    );
}

// ── Page window builder ───────────────────────────────────────────────────────
function buildPageWindow(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = [];
    const addPage = (p) => { if (!pages.includes(p) && p >= 1 && p <= total) pages.push(p); };

    // Always show first and last
    addPage(1);
    addPage(total);

    // Window around current
    for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
        addPage(i);
    }

    pages.sort((a, b) => a - b);

    // Insert ellipsis gaps
    const result = [];
    for (let i = 0; i < pages.length; i++) {
        result.push(pages[i]);
        if (i < pages.length - 1 && pages[i + 1] - pages[i] > 1) {
            result.push('...');
        }
    }
    return result;
}
