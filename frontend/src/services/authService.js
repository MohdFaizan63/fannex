import api from './api';

export const authService = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),

    // OTP
    sendOtp: (email) => api.post('/auth/send-otp', { email }),
    verifyOtp: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
    loginWithOtp: (email, otp) => api.post('/auth/login-otp', { email, otp }),

    // Google
    googleAuth: (idToken) => api.post('/auth/google', { idToken }),

    // Password
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (data) => api.post('/auth/reset-password', data),
};
