/**
 * pricingController.js — Geo-based smart pricing endpoints
 *
 * Public endpoint:
 *   GET /api/v1/pricing/:username   → returns display price for the creator
 *
 * Admin endpoints (requires JWT + admin role):
 *   GET    /api/v1/pricing/admin/tiers       → list all pricing tiers
 *   POST   /api/v1/pricing/admin/tiers       → create a tier
 *   PUT    /api/v1/pricing/admin/tiers/:id   → update a tier
 *   DELETE /api/v1/pricing/admin/tiers/:id   → delete a tier
 *
 * SECURITY: Pricing is computed entirely on the backend.
 * The frontend only receives the final display price.
 */

const CreatorProfile = require('../models/CreatorProfile');
const PricingTier    = require('../models/PricingTier');
const { getDisplayPrice } = require('../utils/geoPrice');

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC — Get display price for a creator (country from geoMiddleware)
// GET /api/v1/pricing/:username
// ──────────────────────────────────────────────────────────────────────────────
const getCreatorPrice = async (req, res, next) => {
    try {
        const { username } = req.params;
        const country = req.country || 'IN';  // set by geoMiddleware

        // Fetch creator's base INR price
        const profile = await CreatorProfile
            .findOne({ username: username.toLowerCase() })
            .select('subscriptionPrice userId displayName')
            .lean();

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Creator not found' });
        }

        // Fetch only active tiers (cached in future via Redis)
        const tiers = await PricingTier.find({ active: true }).lean();

        const pricing = getDisplayPrice(profile.subscriptionPrice, country, tiers);

        return res.status(200).json({
            success: true,
            data: {
                ...pricing,
                creator: {
                    username: profile.username,
                    displayName: profile.displayName,
                },
            },
        });
    } catch (err) {
        next(err);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN — List all pricing tiers
// GET /api/v1/pricing/admin/tiers
// ──────────────────────────────────────────────────────────────────────────────
const listTiers = async (req, res, next) => {
    try {
        const tiers = await PricingTier.find().sort({ region: 1, minInr: 1 }).lean();
        res.status(200).json({ success: true, data: tiers });
    } catch (err) {
        next(err);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN — Create a pricing tier
// POST /api/v1/pricing/admin/tiers
// Body: { region, minInr, maxInr, usdPrice, active }
// ──────────────────────────────────────────────────────────────────────────────
const createTier = async (req, res, next) => {
    try {
        const { region, minInr, maxInr, usdPrice, active } = req.body;

        if (!region || minInr === undefined || usdPrice === undefined) {
            return res.status(400).json({ success: false, message: 'region, minInr, and usdPrice are required' });
        }

        const tier = await PricingTier.create({
            region,
            minInr: Number(minInr),
            maxInr: maxInr !== undefined && maxInr !== null ? Number(maxInr) : null,
            usdPrice: Number(usdPrice),
            active: active !== undefined ? Boolean(active) : true,
        });

        res.status(201).json({ success: true, data: tier });
    } catch (err) {
        next(err);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN — Update a pricing tier
// PUT /api/v1/pricing/admin/tiers/:id
// ──────────────────────────────────────────────────────────────────────────────
const updateTier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { region, minInr, maxInr, usdPrice, active } = req.body;

        const update = {};
        if (region    !== undefined) update.region   = region;
        if (minInr    !== undefined) update.minInr   = Number(minInr);
        if (maxInr    !== undefined) update.maxInr   = maxInr !== null ? Number(maxInr) : null;
        if (usdPrice  !== undefined) update.usdPrice = Number(usdPrice);
        if (active    !== undefined) update.active   = Boolean(active);

        const tier = await PricingTier.findByIdAndUpdate(id, update, { new: true, runValidators: true });

        if (!tier) return res.status(404).json({ success: false, message: 'Tier not found' });

        res.status(200).json({ success: true, data: tier });
    } catch (err) {
        next(err);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN — Delete a pricing tier
// DELETE /api/v1/pricing/admin/tiers/:id
// ──────────────────────────────────────────────────────────────────────────────
const deleteTier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tier = await PricingTier.findByIdAndDelete(id);
        if (!tier) return res.status(404).json({ success: false, message: 'Tier not found' });
        res.status(200).json({ success: true, message: 'Pricing tier deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCreatorPrice,
    listTiers,
    createTier,
    updateTier,
    deleteTier,
};
