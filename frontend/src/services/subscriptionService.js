import api from './api';

const subscriptionService = {
    /** GET /subscriptions/my — returns current user's active subscriptions with creator info */
    mySubscriptions: () => api.get('/subscriptions/my'),

    /**
     * POST /payment/create-order — creates a Cashfree payment order.
     * Backend returns { orderId, paymentSessionId, cfMode, amount, gstBreakdown }
     * The caller should pass paymentSessionId to the Cashfree JS SDK.
     */
    createOrder: (creatorId) => api.post('/payment/create-order', { creatorId }),

    /** POST /payment/verify — verify a Cashfree payment after the redirect back to our site */
    verifyPayment: (data) => api.post('/payment/verify', data),

    /** GET /payment/subscription-status/:creatorId — check subscription for logged-in user */
    checkStatus: (creatorId) =>
        api.get(`/payment/subscription-status/${creatorId}`),

    /** DELETE /payment/subscription/:subscriptionId — cancel subscription */
    cancelSubscription: (subscriptionId) =>
        api.delete(`/payment/subscription/${subscriptionId}`),
};

export default subscriptionService;

