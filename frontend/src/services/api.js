import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    withCredentials: true,
    // 30s timeout — DigitalOcean Droplet is always-on (no cold starts)
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT from localStorage ──────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('fannex_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Response interceptor: handle 401 globally + retry on timeout ─────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('fannex_token');
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // Retry once on network timeout/connection error (handles cold starts)
        const config = error.config;
        if (!config || config._retried) return Promise.reject(error);

        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        const isNetworkError = !error.response && error.request;

        if (isTimeout || isNetworkError) {
            config._retried = true;
            // Wait 2s then retry with a longer timeout (30s for cold start wake-up)
            await new Promise((r) => setTimeout(r, 2000));
            config.timeout = 30000;
            console.warn('[Fannex] Server cold start detected — retrying request…');
            return api(config);
        }

        return Promise.reject(error);
    }
);

export default api;
