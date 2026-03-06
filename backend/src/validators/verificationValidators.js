const Joi = require('joi');

/**
 * Schema for POST /api/verification (submit KYC verification).
 *
 * Note: Document uploads (govIdFront, govIdBack, selfie) are handled by Multer
 * on req.files, so they are NOT part of req.body and not validated here.
 *
 * Fields:
 *   fullName    - required, person's legal name
 *   dateOfBirth - required, ISO date string (YYYY-MM-DD)
 *   address     - required object with street, city, state, postalCode, country
 */
const submitVerificationSchema = Joi.object({
    fullName: Joi.string()
        .min(2)
        .max(100)
        .required()
        .label('Full Name'),

    dateOfBirth: Joi.string()
        .isoDate()
        .required()
        .label('Date of Birth')
        .messages({
            'string.isoDate': 'Date of Birth must be a valid ISO date (YYYY-MM-DD)',
        }),

    address: Joi.object({
        street: Joi.string().min(3).max(200).required().label('Street'),
        city: Joi.string().min(2).max(100).required().label('City'),
        state: Joi.string().min(2).max(100).required().label('State'),
        postalCode: Joi.string()
            .pattern(/^[A-Z0-9\s\-]{3,10}$/i)
            .required()
            .label('Postal Code')
            .messages({
                'string.pattern.base': 'Postal Code must be 3–10 alphanumeric characters',
            }),
        country: Joi.string().min(2).max(100).required().label('Country'),
    })
        .required()
        .label('Address'),
});

/**
 * Schema for PATCH /api/verification (re-submit after rejection).
 * All fields are optional — the creator may update only what changed.
 */
const updateVerificationSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).optional().label('Full Name'),

    dateOfBirth: Joi.string()
        .isoDate()
        .optional()
        .label('Date of Birth')
        .messages({ 'string.isoDate': 'Date of Birth must be a valid ISO date (YYYY-MM-DD)' }),

    address: Joi.object({
        street: Joi.string().min(3).max(200).optional().label('Street'),
        city: Joi.string().min(2).max(100).optional().label('City'),
        state: Joi.string().min(2).max(100).optional().label('State'),
        postalCode: Joi.string()
            .pattern(/^[A-Z0-9\s\-]{3,10}$/i)
            .optional()
            .label('Postal Code'),
        country: Joi.string().min(2).max(100).optional().label('Country'),
    }).optional().label('Address'),
});

module.exports = { submitVerificationSchema, updateVerificationSchema };
