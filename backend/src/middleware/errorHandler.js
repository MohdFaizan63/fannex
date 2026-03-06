const AppError = require('../utils/AppError');

// ─── Error type normalizers ───────────────────────────────────────────────────
// Each function receives the raw error and returns an AppError (or null if it
// doesn't handle this error type).

const handleCastError = (err) =>
    new AppError(`Invalid ${err.path}: '${err.value}' is not a valid ID.`, 404);

const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(
        `Duplicate value for '${field}'. Please use a different value.`,
        400
    );
};

const handleValidationError = (err) => {
    const messages = Object.values(err.errors).map((e) => e.message).join('. ');
    return new AppError(`Validation failed: ${messages}`, 400);
};

const handleJWTError = () =>
    new AppError('Invalid token — please log in again.', 401);

const handleJWTExpiredError = () =>
    new AppError('Your session has expired — please log in again.', 401);

const handleMulterError = (err) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return new AppError('File is too large. Please check the maximum allowed size.', 400);
    }
    return new AppError(`File upload error: ${err.message}`, 400);
};

/**
 * Razorpay errors come back as objects with `err.error.code` or
 * `err.statusCode === 'BAD_REQUEST_ERROR'`.
 */
const handleRazorpayError = (err) => {
    const razErr = err.error || err;
    const code = razErr.code || razErr.statusCode || 'PAYMENT_ERROR';
    const description = razErr.description || razErr.message || 'Payment processing failed';
    return new AppError(`Payment error [${code}]: ${description}`, 402);
};

const handleCORSError = (err) =>
    new AppError(err.message, 403);

// ─── Response senders ─────────────────────────────────────────────────────────

/** Ensure statusCode is always a safe integer */
const safeCode = (code) => {
    const n = parseInt(code, 10);
    return Number.isInteger(n) && n >= 100 && n < 600 ? n : 500;
};

/** Development: full detail + stack trace */
const sendErrorDev = (err, res) => {
    const statusCode = safeCode(err.statusCode);
    res.status(statusCode).json({
        success: false,
        statusCode,
        message: err.message,
        isOperational: err.isOperational,
        error: err,
        stack: err.stack,
    });
};

/** Production: operational errors get the message; bugs get a generic 500 */
const sendErrorProd = (err, res) => {
    const statusCode = safeCode(err.statusCode);
    if (err.isOperational) {
        res.status(statusCode).json({
            success: false,
            statusCode,
            message: err.message,
        });
    } else {
        console.error('[UNHANDLED ERROR]', err);
        res.status(500).json({
            success: false,
            statusCode: 500,
            message: 'Something went wrong. Please try again later.',
        });
    }
};

// ─── Global Error Handler ─────────────────────────────────────────────────────
const globalErrorHandler = (err, req, res, next) => {
    let workingErr = err;

    // Promote plain Error objects that carry a numeric statusCode < 500
    if (!(workingErr instanceof AppError) && Number.isInteger(workingErr.statusCode) && workingErr.statusCode < 500) {
        workingErr = new AppError(workingErr.message, workingErr.statusCode);
    }

    // Default to 500 if statusCode was never set (or is a non-integer string)
    workingErr.statusCode = safeCode(workingErr.statusCode);
    workingErr.message = workingErr.message || 'Internal Server Error';

    if (process.env.NODE_ENV !== 'production') {
        console.error(`[ERROR] ${workingErr.statusCode} — ${workingErr.message}`);
    }

    // ── Normalize well-known error types to AppErrors ────────────────────────
    let normalizedErr = workingErr;

    if (workingErr.name === 'CastError' && workingErr.kind === 'ObjectId') {
        normalizedErr = handleCastError(workingErr);
    } else if (workingErr.code === 11000) {
        normalizedErr = handleDuplicateKeyError(workingErr);
    } else if (workingErr.name === 'ValidationError') {
        normalizedErr = handleValidationError(workingErr);
    } else if (workingErr.name === 'JsonWebTokenError') {
        normalizedErr = handleJWTError();
    } else if (workingErr.name === 'TokenExpiredError') {
        normalizedErr = handleJWTExpiredError();
    } else if (workingErr.name === 'MulterError') {
        normalizedErr = handleMulterError(workingErr);
    } else if (workingErr.error?.code || workingErr.statusCode === 'BAD_REQUEST_ERROR') {
        // Only treat as Razorpay if statusCode is really the Razorpay string (before we normalised it)
        normalizedErr = handleRazorpayError(workingErr);
    } else if (workingErr.message?.toLowerCase().includes('cors')) {
        normalizedErr = handleCORSError(workingErr);
    }

    // Guarantee the final error has a valid integer statusCode
    normalizedErr.statusCode = safeCode(normalizedErr.statusCode);

    // ── Send response ────────────────────────────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
        sendErrorProd(normalizedErr, res);
    } else {
        sendErrorDev(normalizedErr, res);
    }
};

module.exports = globalErrorHandler;
