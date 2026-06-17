const mongoose = require('mongoose');

/**
 * Generic key-value store for admin-controlled site settings.
 * Each document is uniquely identified by its `key`.
 *
 * Current keys:
 *   exploreFrequency  – Number (1-10): how many times the Explore creator list
 *                       is repeated on the public Explore page.
 */
const siteSettingSchema = new mongoose.Schema(
    {
        key:       { type: String, required: true, unique: true, index: true },
        value:     { type: mongoose.Schema.Types.Mixed, required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('SiteSetting', siteSettingSchema);
