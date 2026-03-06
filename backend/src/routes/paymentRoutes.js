const express = require('express');
const router = express.Router();
const {
    createOrder,
    verifyPayment,
    cancelSubscription,
    handleWebhook,
    checkSubscriptionStatus,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Webhook must use raw body — mounted separately in app.js with express.raw()
router.post('/webhook', handleWebhook);

// Protected payment routes
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/cancel', protect, cancelSubscription);
router.get('/subscription-status/:creatorId', protect, checkSubscriptionStatus);

module.exports = router;
