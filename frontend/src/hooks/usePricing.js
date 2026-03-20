/**
 * usePricing.js — Custom hook to fetch geo-based display price for a creator
 *
 * Usage:
 *   const { price, currency, loading } = usePricing(username);
 *
 * - Calls GET /api/v1/pricing/:username (backend is authoritative)
 * - Caches result in sessionStorage to avoid duplicate network calls
 *   within the same browser session
 * - Returns INR price for Indian users, USD for everyone else
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

const SESSION_PREFIX = 'fannex_geo_price_';

export default function usePricing(username) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        if (!username) {
            setLoading(false);
            return;
        }

        // Try session-level cache first
        const cacheKey = `${SESSION_PREFIX}${username}`;
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                setData(JSON.parse(cached));
                setLoading(false);
                return;
            }
        } catch { /* ignore serialization errors */ }

        let cancelled = false;
        setLoading(true);

        api.get(`/pricing/${username}`)
            .then(({ data: res }) => {
                if (cancelled) return;
                const priceData = res.data;
                setData(priceData);
                try { sessionStorage.setItem(cacheKey, JSON.stringify(priceData)); } catch { /* ignore */ }
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || 'Failed to fetch price');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [username]);

    return {
        // The resolved display price (number)
        price:    data?.final_price ?? null,
        // "INR" | "USD"
        currency: data?.currency ?? 'INR',
        // "IN" | "US" | "ROW"
        region:   data?.region ?? 'IN',
        // Original base price in INR
        basePriceInr: data?.original_price_inr ?? null,
        loading,
        error,
    };
}
