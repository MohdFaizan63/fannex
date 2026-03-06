// ── Loader ────────────────────────────────────────────────────────────────────
/**
 * Full-area centered spinner.
 * @param {string} [size="md"]     — "sm" | "md" | "lg"
 * @param {string} [text]          — optional label below spinner
 * @param {boolean} [fullScreen]   — use min-h-screen instead of min-h-[40vh]
 */
export function Loader({ size = 'md', text, fullScreen = false }) {
    const sizes = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-2', lg: 'w-14 h-14 border-[3px]' };
    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'}`}>
            <div className={`${sizes[size]} rounded-full border-brand-500 border-t-transparent animate-spin`} />
            {text && <p className="text-sm text-surface-500">{text}</p>}
        </div>
    );
}

// ── ErrorMessage ──────────────────────────────────────────────────────────────
/**
 * Inline error banner or block-level error display.
 * @param {string}   message   — error text to show
 * @param {Function} [onRetry] — if provided, shows a Retry button
 * @param {boolean}  [block]   — if true, renders as a centered block (like EmptyState)
 */
export function ErrorMessage({ message, onRetry, block = false }) {
    if (!message) return null;

    if (block) return (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-surface-300 font-medium mb-2">{message}</p>
            {onRetry && (
                <button onClick={onRetry} className="mt-3 btn-outline px-6 py-2 text-sm">
                    Try again
                </button>
            )}
        </div>
    );

    return (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd" />
            </svg>
            <span className="flex-1">{message}</span>
            {onRetry && (
                <button onClick={onRetry}
                    className="text-xs underline hover:text-red-300 flex-shrink-0 ml-1">
                    Retry
                </button>
            )}
        </div>
    );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
/**
 * Centered empty state illustration with optional CTA.
 *
 * @param {string}        emoji        — large emoji icon (e.g. "📭")
 * @param {string}        title        — primary heading
 * @param {string}        [description]— secondary text
 * @param {string}        [actionLabel]— CTA button label
 * @param {Function}      [onAction]   — CTA click handler
 * @param {string}        [actionTo]   — if provided, renders a <Link> instead of button
 */
import { Link } from 'react-router-dom';

export function EmptyState({ emoji = '📭', title, description, actionLabel, onAction, actionTo }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4 py-10">
            <div className="text-5xl mb-4 select-none">{emoji}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-surface-400 max-w-xs leading-relaxed">{description}</p>
            )}
            {actionLabel && (
                <div className="mt-6">
                    {actionTo ? (
                        <Link to={actionTo} className="btn-brand px-7 py-2.5 text-sm">{actionLabel}</Link>
                    ) : (
                        <button onClick={onAction} className="btn-brand px-7 py-2.5 text-sm">{actionLabel}</button>
                    )}
                </div>
            )}
        </div>
    );
}
