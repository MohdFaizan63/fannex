import api from './api';

// ── Creator discovery ──────────────────────────────────────────────────────────
export const creatorService = {
    list: (params) => api.get('/creator/list', { params }),
    getEarnings: () => api.get('/creator/earnings'),
    requestPayout: (amount) => api.post('/creator/request-payout', { amount }),
    listPayouts: (params) => api.get('/creator/payouts', { params }),
    mySubscriptions: (params) => api.get('/creator/my-subscriptions', { params }),
    mySubscribers: (params) => api.get('/creator/my-subscribers', { params }),
    updateProfile: (formData) => api.patch('/creator/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    updatePayoutAccount: (formData) => api.patch('/creator/payout-account', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ── Creator onboarding ─────────────────────────────────────────────────────────

/** Submit a new creator application (multipart/form-data with files) */
export const applyForCreator = (formData) =>
    api.post('/creator/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

/** Check if a username is available. Returns { available: boolean } */
export const checkUsername = (username) =>
    api.get('/creator/check-username', { params: { username } });

/** Get the current user's creator application status */
export const getCreatorStatus = () =>
    api.get('/creator/status');

// ── Posts ──────────────────────────────────────────────────────────────────────
export const postService = {
    getByCreator: (creatorId, params) => api.get(`/posts/creator/${creatorId}`, { params }),
    getById: (id) => api.get(`/posts/${id}`),
    create: (formData) => api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    delete: (id) => api.delete(`/posts/${id}`),
    like: (id) => api.put(`/posts/${id}/like`),
};

// ── Payments ───────────────────────────────────────────────────────────────────
export const paymentService = {
    createOrder: (creatorId) => api.post('/payment/create-order', { creatorId }),
    verifyPayment: (data) => api.post('/payment/verify', data),
};

export default creatorService;
