const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { logActivity, getLogsForUser } = require('../controllers/securityController');

// POST /api/v1/security/log-activity  — authenticated fan logs a suspicious event
router.post('/log-activity', protect, logActivity);

// GET  /api/v1/security/logs          — admin queries logs for a user
router.get('/logs', protect, adminOnly, getLogsForUser);

module.exports = router;
