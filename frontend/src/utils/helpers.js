/**
 * Format a number as Indian currency (₹).
 * e.g. formatCurrency(1500.5) → "₹1,500.50"
 */
export const formatCurrency = (amount, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 })
        .format(amount);

/**
 * Format a date string or Date object to a readable local string.
 * Returns '—' for null/undefined/invalid dates instead of throwing.
 */
export const formatDate = (date, options = {}) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        ...options,
    }).format(d);
};

/**
 * Format a date string or Date object with both date AND time.
 * e.g. "20 Mar 2026, 02:45 PM"
 * Returns '—' for null/undefined/invalid dates instead of throwing.
 */
export const formatDateTime = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(d);
};

/**
 * Truncate a string to maxLength, appending ellipsis if needed.
 */
export const truncate = (str, maxLength = 80) =>
    str?.length > maxLength ? str.slice(0, maxLength) + '…' : str;

/**
 * Extract a friendly error message from an Axios error response.
 */
export const getErrorMessage = (err) =>
    err?.response?.data?.message ||
    err?.response?.data?.errors?.[0]?.message ||
    err?.message ||
    'Something went wrong. Please try again.';

/**
 * Build query string from an object, skipping undefined/null values.
 */
export const buildQueryString = (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return qs.toString();
};
