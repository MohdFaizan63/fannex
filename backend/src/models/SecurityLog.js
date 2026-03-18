const mongoose = require('mongoose');

/**
 * SecurityLog
 * ───────────
 * Stores suspicious activity events for content leak tracing.
 * Light schema — kept simple so it writes fast.
 */
const securityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        action_type: {
            type: String,
            enum: [
                'screenshot_attempt',
                'right_click',
                'devtools_open',
                'tab_switch',
                'copy_attempt',
                'drag_attempt',
            ],
            required: true,
        },
        metadata: {
            type: Map,
            of: String,
            default: {},
        },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
    },
    {
        timestamps: true,
        // Auto-expire logs after 90 days to keep collection lean
        expireAfterSeconds: 60 * 60 * 24 * 90,
    }
);

module.exports = mongoose.model('SecurityLog', securityLogSchema);
