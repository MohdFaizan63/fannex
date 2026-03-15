const express = require('express');
const router = express.Router();
const {
    getAllUsers, getUserById, banUser, unbanUser, deleteUser,
    getAllPosts, adminDeletePost,
    getAnalytics,
    getVerifications, approveVerification, rejectVerification,
    listAllPayouts, approvePayout, rejectPayout, markPaid,
    repairStats,
    dedupSubscriptions,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require JWT + admin role
router.use(protect);
router.use(authorize('admin'));

// ── User Management ──────────────────────────────────────────────────────────
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/unban', unbanUser);
router.delete('/users/:id', deleteUser);

// ── Post Management ──────────────────────────────────────────────────────────
router.get('/posts', getAllPosts);
router.delete('/posts/:id', adminDeletePost);

// ── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics', getAnalytics);

// ── KYC Verification Management ──────────────────────────────────────────────
router.get('/verifications', getVerifications);
router.patch('/verification/:id/approve', approveVerification);
router.patch('/verification/:id/reject', rejectVerification);

// ── Payout Management ────────────────────────────────────────────────────────
router.get('/payouts', listAllPayouts);
router.patch('/payouts/:id/approve', approvePayout);
router.patch('/payouts/:id/reject', rejectPayout);
router.patch('/payouts/:id/mark-paid', markPaid);

// ── One-time data repair ─────────────────────────────────────────────────────
// POST /api/admin/repair-stats — recalculates totalPosts and totalSubscribers
router.post('/repair-stats', repairStats);

// POST /api/admin/dedup-subscriptions — removes duplicate Subscription documents
// Run once after deploying the unique index to clean existing bad data
router.post('/dedup-subscriptions', dedupSubscriptions);

module.exports = router;
