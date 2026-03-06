/**
 * Notification helper service.
 *
 * Provides a simple API for creating notifications from anywhere
 * in the codebase — controllers, event handlers, cron jobs, etc.
 */
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');

/**
 * Create a single notification.
 * @returns {Promise<import('mongoose').Document>}
 */
const createNotification = async ({
    recipientId,
    senderId,
    type,
    title,
    body = '',
    referenceId,
    referenceModel,
}) => {
    // Never notify yourself
    if (senderId && recipientId.toString() === senderId.toString()) return null;

    return Notification.create({
        recipientId,
        senderId,
        type,
        title,
        body,
        referenceId,
        referenceModel,
    });
};

/**
 * Notify all active subscribers of a creator.
 * Used when a creator publishes a new post, for example.
 *
 * @param {string} creatorId  The creator's User._id
 * @param {object} data       { type, title, body, referenceId, referenceModel }
 */
const notifySubscribers = async (creatorId, { type, title, body, referenceId, referenceModel }) => {
    const subs = await Subscription.find({
        creatorId,
        status: 'active',
        expiresAt: { $gt: new Date() },
    })
        .select('userId')
        .lean();

    if (!subs.length) return;

    const docs = subs.map((s) => ({
        recipientId: s.userId,
        senderId: creatorId,
        type,
        title,
        body,
        referenceId,
        referenceModel,
    }));

    // Bulk insert — failures are non-critical, so swallow errors
    try {
        await Notification.insertMany(docs, { ordered: false });
    } catch (_) { /* ignore duplicates / partial failures */ }
};

module.exports = { createNotification, notifySubscribers };
