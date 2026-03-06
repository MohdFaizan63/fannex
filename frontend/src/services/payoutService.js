import api from './api';

/**
 * payoutService — creator payout workflows.
 * Handles requesting payouts and listing payout history.
 */
const payoutService = {
    /**
     * GET /creator/earnings — fetch the logged-in creator's earnings ledger.
     * Returns: { totalEarned, pendingAmount, withdrawnAmount }
     */
    getEarnings: () => api.get('/creator/earnings'),

    /**
     * POST /creator/request-payout — submit a payout request.
     * @param {number} amount — must be ≤ pendingAmount, min ₹1, max 2 decimal places
     */
    requestPayout: (amount) =>
        api.post('/creator/request-payout', { amount }),

    /**
     * GET /creator/payouts — paginated list of the creator's own payout requests.
     * @param {{ page?: number, limit?: number }} params
     */
    listMyPayouts: (params) =>
        api.get('/creator/payouts', { params }),
};

export default payoutService;
