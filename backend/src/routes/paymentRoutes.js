const express = require('express');
const router = express.Router();
const {
    createOrder,
    verifyPayment,
    cancelSubscription,
    handleWebhook,
    checkSubscriptionStatus,
    createGiftOrder,
    verifyGift,
    createWalletOrder,
    verifyWalletRecharge,
    getWalletBalance,
    getWalletTransactions,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Webhook must use raw body — mounted separately in app.js with express.raw()
router.post('/webhook', handleWebhook);

// Protected payment routes
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/cancel', protect, cancelSubscription);
router.get('/subscription-status/:creatorId', protect, checkSubscriptionStatus);

// Gift routes
router.post('/gift-order', protect, createGiftOrder);
router.post('/gift-verify', protect, verifyGift);

// Wallet routes
router.post('/wallet-order', protect, createWalletOrder);
router.post('/wallet-verify', protect, verifyWalletRecharge);
router.get('/wallet-balance', protect, getWalletBalance);
router.get('/wallet-transactions', protect, getWalletTransactions);

module.exports = router;

