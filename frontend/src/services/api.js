import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    withCredentials: true,
    timeout: 60000, // 60s — Render free tier can take 50s+ on cold start
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT from localStorage ──────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('fannex_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Response interceptor: handle 401 globally ───────────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('fannex_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
