const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
    getChatSettings,
    updateChatSettings,
    createChatUnlockOrder,
    verifyChatUnlock,
    getUserRooms,
    getCreatorRooms,
    getCreatorChatStats,
    getRoomMessages,
    sendMessage,
    createGiftOrder,
    verifyGift,
    getChatStatus,
} = require('../controllers/chatController');

// ── Creator chat management ───────────────────────────────────────────────────
router.get('/creator/settings', protect, getChatSettings);
router.patch('/creator/settings', protect, updateChatSettings);
router.get('/creator/rooms', protect, getCreatorRooms);
router.get('/creator/stats', protect, getCreatorChatStats);


// ── User: check status + unlock flow ──────────────────────────────────────────
router.get('/status/:creatorId', protect, getChatStatus);
router.post('/unlock', protect, createChatUnlockOrder);
router.post('/unlock/verify', protect, verifyChatUnlock);

// ── User: inbox ────────────────────────────────────────────────────────────────
router.get('/rooms', protect, getUserRooms);

// ── Shared: messages ──────────────────────────────────────────────────────────
router.get('/rooms/:chatId/messages', protect, getRoomMessages);
router.post('/rooms/:chatId/messages', protect, sendMessage);

// ── Gifts ──────────────────────────────────────────────────────────────────────
router.post('/gift/order', protect, createGiftOrder);
router.post('/gift/verify', protect, verifyGift);

module.exports = router;
