/**
 * pricingRoutes.js — Geo-based smart pricing routes
 *
 * Public:
 *   GET /api/v1/pricing/:username        → display price for a creator
 *
 * Admin (JWT + admin role):
 *   GET    /api/v1/pricing/admin/tiers
 *   POST   /api/v1/pricing/admin/tiers
 *   PUT    /api/v1/pricing/admin/tiers/:id
 *   DELETE /api/v1/pricing/admin/tiers/:id
 */

const express = require('express');
const router  = express.Router();

const geoMiddleware = require('../middleware/geoMiddleware');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    getCreatorPrice,
    listTiers,
    createTier,
    updateTier,
    deleteTier,
} = require('../controllers/pricingController');

// ── Public: geo price for a creator ──────────────────────────────────────────
// geoMiddleware runs per-request to detect country (uses CF header in prod,
// ipapi.co fallback in dev). No auth required — this is a public page.
router.get('/:username', geoMiddleware, getCreatorPrice);

// ── Admin: manage pricing tiers ───────────────────────────────────────────────
// "admin" prefix in path keeps these clearly separated & avoids param conflicts
router.get('/admin/tiers',        protect, authorize('admin'), listTiers);
router.post('/admin/tiers',       protect, authorize('admin'), createTier);
router.put('/admin/tiers/:id',    protect, authorize('admin'), updateTier);
router.delete('/admin/tiers/:id', protect, authorize('admin'), deleteTier);

module.exports = router;
