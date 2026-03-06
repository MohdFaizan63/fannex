const Joi = require('joi');

/**
 * Schema for POST /api/posts
 *
 * Note: `media` is handled by Multer (multipart form) so it's NOT part of req.body.
 * We only validate the text fields sent alongside the file.
 *
 * Fields:
 *   caption  - optional string, max 2000 chars
 *   isLocked - optional boolean (Joi will coerce the "true"/"false" strings that
 *              multipart forms send to real booleans)
 */
const createPostSchema = Joi.object({
    caption: Joi.string()
        .max(2000)
        .allow('', null)
        .optional()
        .default('')
        .label('Caption'),

    isLocked: Joi.boolean()
        .truthy('true', '1')     // accept stringified booleans from multipart
        .falsy('false', '0')
        .default(false)
        .optional()
        .label('Is Locked'),
});

module.exports = { createPostSchema };
