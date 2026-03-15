import api from './api';

/**
 * payoutService — creator payout workflows.
 * Handles requesting payouts, listing payout history, and earnings history.
 */
const payoutService = {
    /** GET /creator/earnings — fetch the logged-in creator's earnings ledger. */
    getEarnings: () => api.get('/creator/earnings'),

    /** POST /creator/request-payout — submit a payout request. */
    requestPayout: (amount) => api.post('/creator/request-payout', { amount }),

    /** GET /creator/payouts — paginated list of the creator's own payout requests. */
    listMyPayouts: (params) => api.get('/creator/payouts', { params }),

    /**
     * GET /creator/earnings-history — paginated payment transactions for the creator.
     * @param {{ type?: 'all'|'subscription'|'gift'|'chat_unlock', page?: number, limit?: number }} params
     */
    getEarningsHistory: (params) => api.get('/creator/earnings-history', { params }),
};

export default payoutService;
