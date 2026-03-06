import api from './api';

/**
 * Notification API service.
 */
const notificationService = {
    /** Get paginated notifications for the logged-in user */
    getAll: (params = {}) =>
        api.get('/notifications', { params }).then((r) => r.data),

    /** Get unread notification count */
    getUnreadCount: () =>
        api.get('/notifications/unread-count').then((r) => r.data),

    /** Mark a single notification as read */
    markAsRead: (id) =>
        api.patch(`/notifications/${id}/read`).then((r) => r.data),

    /** Mark all notifications as read */
    markAllRead: () =>
        api.patch('/notifications/read-all').then((r) => r.data),
};

export default notificationService;
