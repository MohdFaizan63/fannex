const mongoose = require('mongoose');

const dreamFundContributionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        creatorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
            index: true,
        },
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'DreamFund',
            index: true,
        },
        // Amount in INR (base amount, before GST)
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        // Cashfree order ID for idempotency / traceability
        paymentId: {
            type: String,
            index: true,
            sparse: true,
        },
        message: {
            type: String,
            maxlength: 300,
            default: '',
        },
        isAnonymous: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Aggregation index: sum contributions per goal
dreamFundContributionSchema.index({ goalId: 1, createdAt: -1 });
// Top contributors per goal
dreamFundContributionSchema.index({ goalId: 1, amount: -1 });
// Idempotency: only one contribution per payment order
dreamFundContributionSchema.index({ paymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DreamFundContribution', dreamFundContributionSchema);
