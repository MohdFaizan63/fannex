const mongoose = require('mongoose');

const creatorProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        // Onboarding fields
        displayName: { type: String, default: '' },
        username: { type: String, default: '', lowercase: true, index: true, unique: true, sparse: true },
        bio: { type: String, default: '' },
        instagramUrl: { type: String, default: '' },  // optional Instagram profile link
        countryOfResidency: { type: String, default: '' },
        creatorType: { type: String, enum: ['human', 'ai'], default: 'human' },
        genre: {
            type: String,
            enum: ['fitness', 'gaming', 'fashion', 'education', 'art', 'music', 'lifestyle', 'other', ''],
            default: '',
        },

        // Media
        profileImage: { type: String, default: '' },
        profileImagePosition: { type: Number, default: 50, min: 0, max: 100 },
        coverImage: { type: String, default: '' },
        coverImagePosition: { type: Number, default: 50, min: 0, max: 100 },

        // Monetisation — min: 0 guards prevent negative prices at schema level (see also BUG-8 fix in controller)
        subscriptionPrice: { type: Number, default: 1, min: 0 },

        // Chat monetisation
        chatEnabled: { type: Boolean, default: true },
        chatPrice: { type: Number, default: 1, min: 0 },    // ₹ per conversation unlock
        messagePrice: { type: Number, default: 1, min: 0 },   // ₹ per message deducted from fan wallet
        minGift: { type: Number, default: 1, min: 0 },       // minimum gift amount
        maxGift: { type: Number, default: 10000, min: 0 },    // maximum gift amount


        // Stats (denormalised)
        totalSubscribers: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 },

        // Admin approval
        verificationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        // NOTE: Sensitive KYC data (PAN, Aadhaar, bank account) is stored ONLY in the
        // CreatorVerification model where it is encrypted at rest with AES-256-GCM.
        // The verificationData sub-document has been removed as it stored PII as plain text.
    },
    { timestamps: true }
);

// ── Performance indexes ────────────────────────────────────────────────────────
// Explore default sort: verificationStatus:'approved', sort by -totalSubscribers
creatorProfileSchema.index({ verificationStatus: 1, totalSubscribers: -1 });
// Explore category-filtered sort
creatorProfileSchema.index({ verificationStatus: 1, genre: 1, totalSubscribers: -1 });
// Full-text search on displayName and bio (replaces slow $regex scan)
creatorProfileSchema.index({ displayName: 'text', bio: 'text' }, { weights: { displayName: 10, bio: 1 } });

module.exports = mongoose.model('CreatorProfile', creatorProfileSchema);
