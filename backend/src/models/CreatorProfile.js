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

        // Monetisation
        subscriptionPrice: { type: Number, default: 99 },

        // Chat monetisation
        chatEnabled: { type: Boolean, default: true },
        chatPrice: { type: Number, default: 499 },    // ₹ per conversation unlock
        minGift: { type: Number, default: 50 },       // minimum gift amount
        maxGift: { type: Number, default: 10000 },    // maximum gift amount


        // Stats (denormalised)
        totalSubscribers: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 },

        // Admin approval
        verificationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        verificationData: {
            fullName: { type: String, default: '' },
            panNumber: { type: String, default: '' },
            aadhaarNumber: { type: String, default: '' },
            bankAccountNumber: { type: String, default: '' },
            ifscCode: { type: String, default: '' },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CreatorProfile', creatorProfileSchema);
