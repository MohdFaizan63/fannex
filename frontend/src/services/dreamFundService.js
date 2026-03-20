import api from './api';

const dreamFundService = {
    // ── Creator ─────────────────────────────────────────────────────────────
    createGoal: (formData) =>
        api.post('/dream-fund/goals', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

    getMyGoals: () =>
        api.get('/dream-fund/goals/me'),

    updateGoal: (id, formData) =>
        api.put(`/dream-fund/goals/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

    uploadProof: (id, formData) =>
        api.post(`/dream-fund/goals/${id}/proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

    // ── Public / Fan ─────────────────────────────────────────────────────────
    getCreatorGoals: (creatorId) =>
        api.get(`/dream-fund/goals/${creatorId}`),

    getTopContributors: (goalId) =>
        api.get(`/dream-fund/goals/${goalId}/contributors`),

    getRecentContributions: (goalId) =>
        api.get(`/dream-fund/goals/${goalId}/feed`),

    // ── Contribution payment ─────────────────────────────────────────────────
    createContributionOrder: (payload) =>
        api.post('/dream-fund/contribute/order', payload),

    verifyContribution: (payload) =>
        api.post('/dream-fund/contribute/verify', payload),

    // ── Admin ─────────────────────────────────────────────────────────────────
    adminListDreamFunds: (status) =>
        api.get('/admin/dream-funds', { params: status ? { status } : {} }),

    adminApproveGoal: (id) =>
        api.patch(`/admin/dream-funds/${id}/approve`),

    adminRejectGoal: (id, reason) =>
        api.patch(`/admin/dream-funds/${id}/reject`, { reason }),

    adminVerifyProof: (id) =>
        api.patch(`/admin/dream-funds/${id}/verify-proof`),

    adminRejectProof: (id, reason) =>
        api.patch(`/admin/dream-funds/${id}/reject-proof`, { reason }),
};

export default dreamFundService;
