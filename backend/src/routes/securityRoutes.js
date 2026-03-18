const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { logActivity, getLogsForUser } = require('../controllers/securityController');

// POST /api/v1/security/log-activity  — authenticated fan logs a suspicious event
router.post('/log-activity', protect, logActivity);

// GET  /api/v1/security/logs          — admin queries logs (role check in controller)
router.get('/logs', protect, getLogsForUser);

module.exports = router;

