import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // true while checking session on mount

    // ── Restore session from localStorage token ──────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('fannex_token');
        if (!token) { setLoading(false); return; }

        authService.getMe()
            .then(({ data }) => setUser(data.data))
            .catch(() => localStorage.removeItem('fannex_token'))
            .finally(() => setLoading(false));
    }, []);

    // ── Auto-poll when creator application is pending ────────────────────────
    useEffect(() => {
        if (!user || user.creatorApplicationStatus !== 'pending') return;

        const poll = () => {
            // Skip polling when the tab is hidden (saves network + battery)
            if (document.visibilityState === 'hidden') return;
            authService.getMe()
                .then(({ data }) => setUser(data.data))
                .catch(() => { }); // silent
        };

        // Poll every 60s (was 20s — 3× fewer background requests)
        const interval = setInterval(poll, 60_000);

        // Also re-poll immediately when the tab becomes visible again
        document.addEventListener('visibilitychange', poll);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', poll);
        };
    }, [user?.creatorApplicationStatus]);

    // ── Auth actions ──────────────────────────────────────────────────────────

    /** Standard email + password login */
    const login = useCallback(async (credentials) => {
        const { data } = await authService.login(credentials);
        localStorage.setItem('fannex_token', data.token);
        setUser(data.user);
        return data;
    }, []);

    /** Register new user (returns user but NOT logged in — needs OTP verify) */
    const register = useCallback(async (payload) => {
        const { data } = await authService.register(payload);
        return data; // { success, message, user } — no token until OTP verified
    }, []);

    /** Verify OTP after registration → sets user + token */
    const verifyOtp = useCallback(async (email, otp) => {
        const { data } = await authService.verifyOtp(email, otp);
        localStorage.setItem('fannex_token', data.token);
        setUser(data.user);
        return data;
    }, []);

    /** Login with OTP (passwordless) → sets user + token */
    const loginWithOtp = useCallback(async (email, otp) => {
        const { data } = await authService.loginWithOtp(email, otp);
        localStorage.setItem('fannex_token', data.token);
        setUser(data.user);
        return data;
    }, []);

    /** Google login/register → sets user + token */
    const googleLogin = useCallback(async (idToken) => {
        const { data } = await authService.googleAuth(idToken);
        localStorage.setItem('fannex_token', data.token);
        setUser(data.user);
        return data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('fannex_token');
        setUser(null);
        authService.logout().catch(() => { });
    }, []);

    const refreshUser = useCallback(async () => {
        const { data } = await authService.getMe();
        setUser(data.data);
        return data.data;
    }, []);

    // ── Derived helpers ───────────────────────────────────────────────────────
    const isAuthenticated = !!user;
    const isCreator = user?.role === 'creator';
    const isAdmin = user?.role === 'admin';
    const isVerified = user?.isVerified === true;
    const creatorApplicationStatus = user?.creatorApplicationStatus ?? 'none';

    return (
        <AuthContext.Provider value={{
            user, loading,
            login, register, verifyOtp, loginWithOtp, googleLogin, logout, refreshUser,
            isAuthenticated, isCreator, isAdmin, isVerified,
            creatorApplicationStatus,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// Convenience hook — throws if used outside AuthProvider
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}

export default AuthContext;
