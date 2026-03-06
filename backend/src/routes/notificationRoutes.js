const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllRead,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(protect);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);        // must come before /:id/read
router.patch('/:id/read', markAsRead);

module.exports = router;
