import api from './api';

export const adminService = {
    // Users
    getUsers: (params) => api.get('/admin/users', { params }),
    banUser: (id) => api.put(`/admin/users/${id}/ban`),
    unbanUser: (id) => api.put(`/admin/users/${id}/unban`),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),
    // Posts
    getPosts: (params) => api.get('/admin/posts', { params }),
    deletePost: (id) => api.delete(`/admin/posts/${id}`),
    // Analytics
    getAnalytics: () => api.get('/admin/analytics'),
    // Verifications
    getVerifications: (params) => api.get('/admin/verifications', { params }),
    approveVerification: (id) => api.patch(`/admin/verification/${id}/approve`),
    rejectVerification: (id, reason) => api.patch(`/admin/verification/${id}/reject`, { rejectionReason: reason }),
    // Payouts
    getPayouts: (params) => api.get('/admin/payouts', { params }),
    approvePayout: (id) => api.patch(`/admin/payouts/${id}/approve`),
    rejectPayout: (id, notes) => api.patch(`/admin/payouts/${id}/reject`, { notes }),
    markPaid: (id) => api.patch(`/admin/payouts/${id}/mark-paid`),
    // Creator management
    getCreators: (params) => api.get('/admin/creators', { params }),
    getCreatorDetail: (id) => api.get(`/admin/creators/${id}`),
    directPayout: (id) => api.post(`/admin/creators/${id}/payout`),
    updateCreatorProfile: (id, data) => api.patch(`/admin/creators/${id}/profile`, data),
    updateCreatorFinancials: (id, data) => api.patch(`/admin/creators/${id}/financials`, data),
    banCreator: (id) => api.put(`/admin/creators/${id}/ban`),
    unbanCreator: (id) => api.put(`/admin/creators/${id}/unban`),
    getCreatorMedia: (id, params) => api.get(`/admin/creators/${id}/media`, { params }),
    deleteCreatorPost: (creatorId, postId) => api.delete(`/admin/creators/${creatorId}/media/${postId}`),
    // Full cascade account deletion
    deleteCreator: (id) => api.delete(`/admin/creators/${id}`),
};

