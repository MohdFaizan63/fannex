/**
 * useContentProtection
 * ────────────────────
 * Detects screenshot attempts, devtools opening, and tab switching.
 * Returns `blurred` (boolean) and `warningMsg` (string | null).
 *
 * NOTE: 100% screenshot prevention is impossible on the web.
 *       This hook discourages attempts and enables traceability.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const BLUR_DURATION_MS = 2500;

export default function useContentProtection({ userId, enabled = true } = {}) {
    const [blurred, setBlurred]       = useState(false);
    const [warningMsg, setWarningMsg] = useState(null);
    const blurTimer = useRef(null);

    // ── Trigger blur + optional log ────────────────────────────────────────────
    const triggerBlur = useCallback((reason, logPayload) => {
        if (!enabled) return;
        setBlurred(true);
        setWarningMsg(reason);

        clearTimeout(blurTimer.current);
        blurTimer.current = setTimeout(() => {
            setBlurred(false);
            setWarningMsg(null);
        }, BLUR_DURATION_MS);

        // Fire-and-forget log to backend
        if (userId && logPayload) {
            api.post('/security/log-activity', {
                action_type: logPayload.action_type,
                metadata:    logPayload.metadata || {},
            }).catch(() => {});
        }
    }, [enabled, userId]);

    useEffect(() => {
        if (!enabled) return;

        // ── 1. Disable right-click ─────────────────────────────────────────────
        const onContextMenu = (e) => {
            e.preventDefault();
            triggerBlur('Screenshots & downloads are not allowed', { action_type: 'right_click' });
        };

        // ── 2. Disable text selection drag & copy ──────────────────────────────
        const onSelectStart = (e) => e.preventDefault();
        const onCopy        = (e) => e.preventDefault();
        const onDragStart   = (e) => e.preventDefault();

        // ── 3. PrintScreen / screenshot key combos ─────────────────────────────
        const onKeyUp = (e) => {
            const isPrintScreen  = e.key === 'PrintScreen';
            const isSnip         = e.key === 'S' && e.metaKey && e.shiftKey; // macOS ⌘⇧S
            const isWinSnip      = e.key === 'PrintScreen' || (e.key === 'S' && e.ctrlKey && e.shiftKey);
            if (isPrintScreen || isSnip || isWinSnip) {
                triggerBlur('Screenshots are not allowed', { action_type: 'screenshot_attempt' });
            }
        };

        // ── 4. Tab visibility change (blurs content when tab switches) ─────────
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                setBlurred(true);
            } else {
                // Restore after a brief delay to prevent flicker on quick alt-tab back
                setTimeout(() => setBlurred(false), 500);
            }
        };

        // ── 5. Dev tools detection (window size change heuristic) ──────────────
        const THRESHOLD = 160;
        let devToolsOpen = false;
        const checkDevTools = () => {
            const widthDiff  = window.outerWidth  - window.innerWidth  > THRESHOLD;
            const heightDiff = window.outerHeight - window.innerHeight > THRESHOLD;
            if ((widthDiff || heightDiff) && !devToolsOpen) {
                devToolsOpen = true;
                triggerBlur('Dev tools detected — content hidden', { action_type: 'devtools_open' });
            }
            if (!widthDiff && !heightDiff) devToolsOpen = false;
        };
        const devToolsInterval = setInterval(checkDevTools, 1000);

        document.addEventListener('contextmenu',    onContextMenu);
        document.addEventListener('selectstart',    onSelectStart);
        document.addEventListener('copy',           onCopy);
        document.addEventListener('dragstart',      onDragStart);
        document.addEventListener('keyup',          onKeyUp);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('contextmenu',    onContextMenu);
            document.removeEventListener('selectstart',    onSelectStart);
            document.removeEventListener('copy',           onCopy);
            document.removeEventListener('dragstart',      onDragStart);
            document.removeEventListener('keyup',          onKeyUp);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            clearInterval(devToolsInterval);
            clearTimeout(blurTimer.current);
        };
    }, [enabled, triggerBlur]);

    return { blurred, warningMsg, triggerBlur };
}
