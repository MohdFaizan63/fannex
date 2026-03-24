const express = require('express');
const router = express.Router();
const {
    createGoal,
    getMyGoals,
    updateGoal,
    uploadProof,
    uploadMiddleware,
    getCreatorGoals,
    getTopContributors,
    getRecentContributions,
    createContributionOrder,
    verifyContribution,
} = require('../controllers/dreamFundController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ── CRITICAL: /goals/me MUST be registered BEFORE /goals/:creatorId ──────────
// Otherwise Express treats the literal string "me" as a creatorId parameter.
// This route requires auth so we pass protect inline.
router.get('/goals/me', protect, authorize('creator', 'admin'), getMyGoals);

// ── Public routes (fan-facing) ────────────────────────────────────────────────
router.get('/goals/:creatorId', getCreatorGoals);
router.get('/goals/:id/contributors', getTopContributors);
router.get('/goals/:id/feed', getRecentContributions);

// ── All remaining routes require authentication ───────────────────────────────
router.use(protect);

// Creator management
router.post('/goals', uploadMiddleware, authorize('creator', 'admin'), createGoal);
router.put('/goals/:id', uploadMiddleware, authorize('creator', 'admin'), updateGoal);
router.post('/goals/:id/proof', uploadMiddleware, authorize('creator', 'admin'), uploadProof);

// Fan contribution payment (any authenticated user)
router.post('/contribute/order', createContributionOrder);
router.post('/contribute/verify', verifyContribution);

module.exports = router;
