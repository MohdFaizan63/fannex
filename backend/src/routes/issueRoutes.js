const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const {
    submitIssue,
    listIssues,
    updateIssue,
    getIssueStats,
    reportLimiter,
} = require('../controllers/issueController');

// ── User: submit a report (any logged-in user, rate-limited 5/hour) ───────────
router.post(
    '/report',
    protect,
    reportLimiter,
    upload.single('screenshot'),  // optional screenshot
    submitIssue
);

// ── Admin: manage all reports ─────────────────────────────────────────────────
router.get('/admin',          protect, authorize('admin'), listIssues);
router.get('/admin/stats',    protect, authorize('admin'), getIssueStats);
router.patch('/admin/:id',    protect, authorize('admin'), updateIssue);

module.exports = router;
