const mongoose = require('mongoose');

/**
 * IssueReport — stores user-submitted bug reports, feedback, and feature requests.
 * Submitted via POST /api/v1/issues/report (any authenticated user).
 * Managed via /api/v1/admin/issues (admin only).
 */
const issueReportSchema = new mongoose.Schema(
    {
        // ── Reporter info ──────────────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        userRole: {
            type: String,
            enum: ['user', 'creator', 'admin'],
            default: 'user',
        },

        // ── Issue details ──────────────────────────────────────────────────────
        issueType: {
            type: String,
            enum: ['bug', 'payment_issue', 'subscription_issue', 'chat_issue', 'content_issue', 'feature_request', 'other'],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: [150, 'Title must be 150 characters or fewer'],
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: [3000, 'Description must be 3000 characters or fewer'],
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },

        // ── Attachments & context ──────────────────────────────────────────────
        screenshotUrl: {
            type: String,
            default: '',
        },
        pageUrl: {
            type: String,
            default: '',
            maxlength: 500,
        },
        deviceInfo: {
            type: String,
            default: '',
            maxlength: 500,
        },

        // ── Admin workflow ─────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['open', 'reviewing', 'resolved'],
            default: 'open',
            index: true,
        },
        adminNotes: {
            type: String,
            default: '',
            maxlength: 1000,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Compound indexes for efficient admin queries
issueReportSchema.index({ status: 1, createdAt: -1 });
issueReportSchema.index({ issueType: 1, createdAt: -1 });
issueReportSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('IssueReport', issueReportSchema);
