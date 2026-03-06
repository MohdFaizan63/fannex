const Joi = require('joi');

/**
 * Schema for POST /api/v1/creator/request-payout
 *
 * Rules:
 *   amount - required positive number
 *            accepts up to 2 decimal places (avoids ledger drift)
 *            minimum ₹1 (avoid micro-withdrawals)
 *            maximum ₹10,00,000 per single request (sanity cap)
 */
const requestPayoutSchema = Joi.object({
    amount: Joi.number()
        .positive()
        .precision(2)           // max 2 decimal places
        .min(1)
        .max(1_000_000)
        .required()
        .label('Amount')
        .messages({
            'number.base': 'Amount must be a number.',
            'number.positive': 'Amount must be a positive number.',
            'number.min': 'Minimum payout amount is ₹1.',
            'number.max': 'Maximum single payout request is ₹10,00,000.',
            'number.precision': 'Amount must have at most 2 decimal places.',
            'any.required': 'Payout amount is required.',
        }),
});

module.exports = { requestPayoutSchema };
