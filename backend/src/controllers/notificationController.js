const Notification = require('../models/Notification');
const paginate = require('../utils/paginate');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in user's notifications (paginated)
// @route   GET /api/v1/notifications
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMyNotifications = async (req, res, next) => {
    try {
        const data = await paginate(
            Notification,
            { recipientId: req.user._id },
            {
                page: req.query.page,
                limit: req.query.limit || 20,
                sort: '-createdAt',
                populate: { path: 'senderId', select: 'name avatar' },
            }
        );

        res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get unread notification count
// @route   GET /api/v1/notifications/unread-count
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({
            recipientId: req.user._id,
            isRead: false,
        });

        res.status(200).json({ success: true, count });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Mark a single notification as read
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const markAsRead = async (req, res, next) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId: req.user._id },
            { isRead: true, readAt: new Date() },
            { returnDocument: 'after' }
        );

        if (!notif) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: notif });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Mark all notifications as read
// @route   PATCH /api/v1/notifications/read-all
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const markAllRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllRead };
