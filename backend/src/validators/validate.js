const AppError = require('../utils/AppError');

/**
 * Generic Joi validation middleware factory.
 *
 * Usage in a route file:
 *   const { validate } = require('../validators/validate');
 *   const { registerSchema } = require('../validators/authValidators');
 *   router.post('/register', validate(registerSchema), registerUser);
 *
 * Options applied:
 *   - abortEarly: false   → collect ALL validation errors, not just the first
 *   - allowUnknown: false → reject any field not declared in the schema
 *   - stripUnknown: false → don't silently strip fields (surface the error instead)
 *
 * On failure → 400 AppError with a structured `errors` array.
 * On success → calls next(), body optionally replaced with validated/coerced value.
 *
 * @param {import('joi').ObjectSchema} schema - A compiled Joi schema
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,       // return all errors at once
        allowUnknown: false,     // reject unknown fields
        stripUnknown: false,     // surface unknown-field errors (don't silently drop)
        convert: true,           // coerce strings → numbers/booleans where schema declares them
    });

    if (error) {
        // Flatten Joi ValidationError details into a clean array
        const errors = error.details.map((detail) => ({
            field: detail.context?.label || detail.path.join('.'),
            message: detail.message.replace(/['"]/g, ''), // remove Joi's surrounding quotes
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed. Please check the errors below.',
            errors,
        });
    }

    // Replace req.body with the coerced/validated value so controllers get clean data
    req.body = value;
    next();
};

module.exports = { validate };
