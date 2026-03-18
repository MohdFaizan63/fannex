const SecurityLog = require('../models/SecurityLog');

/**
 * POST /api/v1/security/log-activity
 * Logs a suspicious activity event from the frontend.
 * Rate-limited by the API gateway — one entry per event.
 */
const logActivity = async (req, res) => {
    try {
        const { action_type, metadata } = req.body;

        const ALLOWED_ACTIONS = [
            'screenshot_attempt', 'right_click',
            'devtools_open', 'tab_switch',
            'copy_attempt', 'drag_attempt',
        ];

        if (!action_type || !ALLOWED_ACTIONS.includes(action_type)) {
            return res.status(400).json({ success: false, message: 'Invalid action_type' });
        }

        await SecurityLog.create({
            userId:      req.user._id,
            action_type,
            metadata:    metadata || {},
            ip:          req.ip || req.headers['x-forwarded-for'] || '',
            userAgent:   req.headers['user-agent'] || '',
        });

        res.status(201).json({ success: true });
    } catch (err) {
        // Non-critical endpoint — don't surface error to frontend
        console.error('[SecurityLog] Failed to log activity:', err.message);
        res.status(200).json({ success: true }); // silently succeed
    }
};

/**
 * GET /api/v1/security/logs?userId=xxx  (admin only)
 * Returns recent security logs for a given user.
 */
const getLogsForUser = async (req, res) => {
    try {
        // Admin-only endpoint — check role inline
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);

        const query = userId ? { userId } : {};
        const logs  = await SecurityLog.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name email username')
            .lean();

        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { logActivity, getLogsForUser };
