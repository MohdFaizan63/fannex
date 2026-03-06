import api from './api';

const subscriptionService = {
    /** GET /subscriptions/my — returns current user's active subscriptions with creator info */
    mySubscriptions: () => api.get('/subscriptions/my'),

    /** @deprecated use mySubscriptions() — legacy creator route */
    mySubscriptionsLegacy: (params) => api.get('/creator/my-subscriptions', { params }),

    /**
     * POST /payment/create-checkout-session — create a Stripe Checkout Session.
     * Backend returns { url } — caller should redirect browser to that URL.
     */
    createCheckoutSession: (creatorId) =>
        api.post('/payment/create-checkout-session', { creatorId }),

    /** POST /payment/create-order — Razorpay inline checkout order */
    createOrder: (creatorId) => api.post('/payment/create-order', { creatorId }),

    /** POST /payment/verify — verify Razorpay payment signature after checkout */
    verifyPayment: (data) => api.post('/payment/verify', data),

    /** GET /payment/subscription-status/:creatorId — check subscription for logged-in user */
    checkStatus: (creatorId) =>
        api.get(`/payment/subscription-status/${creatorId}`),

    /** DELETE /payment/subscription/:subscriptionId — cancel subscription */
    cancelSubscription: (subscriptionId) =>
        api.delete(`/payment/subscription/${subscriptionId}`),
};

export default subscriptionService;
