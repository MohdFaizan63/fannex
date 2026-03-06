/**
 * Subscription expiry notification job.
 *
 * Runs on a fixed interval and notifies users whose subscriptions
 * are expiring within the next 3 days — but only once.
 *
 * No external dependency needed — uses setInterval.
 */
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notificationService');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Find subscriptions expiring in the next 3 days that haven't
 * been notified yet and send a `subscription_expiring` notification.
 */
const checkExpiringSubscriptions = async () => {
    try {
        const now = new Date();
        const threshold = new Date(now.getTime() + THREE_DAYS_MS);

        // Only look at active subs expiring within the window
        const expiringSubs = await Subscription.find({
            status: 'active',
            expiresAt: { $gt: now, $lte: threshold },
        })
            .select('userId creatorId expiresAt')
            .populate('creatorId', 'name')
            .lean();

        if (!expiringSubs.length) return;

        // Check which users already have a recent expiry notification
        // to avoid sending duplicates
        const userIds = expiringSubs.map((s) => s.userId);
        const existing = await Notification.find({
            recipientId: { $in: userIds },
            type: 'subscription_expiring',
            createdAt: { $gte: new Date(now.getTime() - THREE_DAYS_MS) },
        })
            .select('recipientId referenceId')
            .lean();

        const notifiedKeys = new Set(
            existing.map((n) => `${n.recipientId}-${n.referenceId}`)
        );

        const toNotify = expiringSubs.filter(
            (s) => !notifiedKeys.has(`${s.userId}-${s._id}`)
        );

        for (const sub of toNotify) {
            const creatorName = sub.creatorId?.name || 'a creator';
            const daysLeft = Math.ceil(
                (new Date(sub.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );

            await createNotification({
                recipientId: sub.userId,
                senderId: sub.creatorId?._id || sub.creatorId,
                type: 'subscription_expiring',
                title: `Your subscription to ${creatorName} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
                body: 'Renew to keep enjoying exclusive content.',
                referenceId: sub._id,
                referenceModel: 'Subscription',
            }).catch(() => { });
        }

        if (toNotify.length > 0) {
            console.log(`📬 Sent ${toNotify.length} subscription expiry notification(s)`);
        }
    } catch (err) {
        console.error('❌ Subscription expiry job error:', err.message);
    }
};

/**
 * Start the periodic check.
 * Call this once after the server is up and the DB is connected.
 */
const startSubscriptionExpiryJob = () => {
    // Run once immediately on startup, then every 6 hours
    checkExpiringSubscriptions();
    setInterval(checkExpiringSubscriptions, SIX_HOURS_MS);
    console.log('⏰ Subscription expiry job scheduled (every 6h)');
};

module.exports = { startSubscriptionExpiryJob, checkExpiringSubscriptions };
