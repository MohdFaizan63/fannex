const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { logActivity, getLogsForUser } = require('../controllers/securityController');

// POST /api/v1/security/log-activity  — authenticated fan logs a suspicious event
router.post('/log-activity', protect, logActivity);

// GET  /api/v1/security/logs          — admin queries logs for a user
router.get('/logs', protect, authorize('admin'), getLogsForUser);

module.exports = router;
