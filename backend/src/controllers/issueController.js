/**
 * Issue Controller — handles user submissions and admin management of issue reports.
 */
const IssueReport = require('../models/IssueReport');
const rateLimit = require('express-rate-limit');

// ipKeyGenerator helper resolves IPv6 addresses correctly
// (required by express-rate-limit ≥ 7 when a keyGenerator may return req.ip)
const { ipKeyGenerator } = require('express-rate-limit');

// ── Rate limiter: max 5 reports per user per hour ─────────────────────────────
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,      // 1 hour
    max: 5,
    keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
    message: { success: false, message: 'Too many reports submitted. Please wait before submitting again.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.user?.role === 'admin', // admins are never rate-limited
});

// ─────────────────────────────────────────────────────────────────────────────
// USER: Submit a new issue report
// POST /api/v1/issues/report
// Access: any authenticated user
// ─────────────────────────────────────────────────────────────────────────────
const submitIssue = async (req, res, next) => {
    try {
        const { issueType, title, description, priority, pageUrl, deviceInfo } = req.body;
        const user = req.user;

        // ── Validate required fields ──────────────────────────────────────────
        if (!issueType || !title?.trim() || !description?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'issueType, title, and description are required.',
            });
        }

        const VALID_TYPES = ['bug', 'payment_issue', 'subscription_issue', 'chat_issue', 'content_issue', 'feature_request', 'other'];
        if (!VALID_TYPES.includes(issueType)) {
            return res.status(400).json({ success: false, message: 'Invalid issue type.' });
        }

        const VALID_PRIORITIES = ['low', 'medium', 'high'];
        const safePriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';

        // ── Handle optional screenshot upload ─────────────────────────────────
        let screenshotUrl = '';
        const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET;

        if (req.file) {
            screenshotUrl = hasCloudinary
                ? req.file.path
                : `${process.env.API_BASE_URL || 'http://localhost:8080'}/uploads/${req.file.filename}`;
        }

        // ── Create the record ─────────────────────────────────────────────────
        const issue = await IssueReport.create({
            userId:      user._id,
            userRole:    user.role || 'user',
            issueType,
            title:       title.trim().slice(0, 150),
            description: description.trim().slice(0, 3000),
            priority:    safePriority,
            screenshotUrl,
            pageUrl:     (pageUrl || '').slice(0, 500),
            deviceInfo:  (deviceInfo || '').slice(0, 500),
            status:      'open',
        });

        // ── Log for admin awareness (optional console alert) ──────────────────
        console.info(`[IssueReport] New ${issueType} report from user ${user._id} — "${title}" [${safePriority}]`);

        res.status(201).json({
            success: true,
            message: 'Thank you. Your report has been submitted. Our team will review it soon.',
            data: { id: issue._id, status: issue.status },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: List all issue reports (paginated, filterable)
// GET /api/v1/issues/admin
// Access: admin only
// ─────────────────────────────────────────────────────────────────────────────
const listIssues = async (req, res, next) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const skip  = (page - 1) * limit;

        const filter = {};
        if (req.query.status    && ['open', 'reviewing', 'resolved'].includes(req.query.status))    filter.status    = req.query.status;
        if (req.query.issueType && req.query.issueType !== 'all') filter.issueType = req.query.issueType;
        if (req.query.priority  && ['low', 'medium', 'high'].includes(req.query.priority))  filter.priority  = req.query.priority;

        const [issues, total] = await Promise.all([
            IssueReport.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name email role')
                .populate('resolvedBy', 'name email')
                .lean(),
            IssueReport.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: issues,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Update issue status / add notes
// PATCH /api/v1/issues/admin/:id
// Access: admin only
// ─────────────────────────────────────────────────────────────────────────────
const updateIssue = async (req, res, next) => {
    try {
        const { status, adminNotes } = req.body;

        const VALID_STATUSES = ['open', 'reviewing', 'resolved'];
        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const update = {};
        if (status)     update.status     = status;
        if (adminNotes !== undefined) update.adminNotes = adminNotes.slice(0, 1000);

        if (status === 'resolved') {
            update.resolvedBy = req.user._id;
            update.resolvedAt = new Date();
        }

        const issue = await IssueReport.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true, runValidators: true }
        ).populate('userId', 'name email');

        if (!issue) return res.status(404).json({ success: false, message: 'Issue report not found.' });

        res.json({ success: true, data: issue });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get issue counts per status (for dashboard stat card)
// GET /api/v1/issues/admin/stats
// ─────────────────────────────────────────────────────────────────────────────
const getIssueStats = async (req, res, next) => {
    try {
        const [open, reviewing, resolved] = await Promise.all([
            IssueReport.countDocuments({ status: 'open' }),
            IssueReport.countDocuments({ status: 'reviewing' }),
            IssueReport.countDocuments({ status: 'resolved' }),
        ]);
        res.json({ success: true, data: { open, reviewing, resolved, total: open + reviewing + resolved } });
    } catch (err) {
        next(err);
    }
};

module.exports = { submitIssue, listIssues, updateIssue, getIssueStats, reportLimiter };
