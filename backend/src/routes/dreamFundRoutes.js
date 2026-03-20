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

// ── Public routes (fan-facing) ────────────────────────────────────────────────
router.get('/goals/:creatorId', getCreatorGoals);
router.get('/goals/:id/contributors', getTopContributors);
router.get('/goals/:id/feed', getRecentContributions);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(protect);

// Creator management
router.post('/goals', uploadMiddleware, authorize('creator', 'admin'), createGoal);
router.get('/goals/me', authorize('creator', 'admin'), getMyGoals);
router.put('/goals/:id', uploadMiddleware, authorize('creator', 'admin'), updateGoal);
router.post('/goals/:id/proof', uploadMiddleware, authorize('creator', 'admin'), uploadProof);

// Fan contribution payment (any authenticated user)
router.post('/contribute/order', createContributionOrder);
router.post('/contribute/verify', verifyContribution);

module.exports = router;
