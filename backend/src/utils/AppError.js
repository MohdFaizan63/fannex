/**
 * AppError — Operational error class for the API.
 *
 * Operational errors are expected failure modes, e.g.
 *   - 404 Not Found
 *   - 400 Bad Request
 *   - 401 Unauthorized
 *
 * Non-operational errors (programming bugs) are handled
 * by globalErrorHandler returning a generic 500.
 */
class AppError extends Error {
    /**
     * @param {string}  message     - Human-readable error message
     * @param {number}  statusCode  - HTTP status code
     */
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;

        // All errors created via AppError are considered operational
        this.isOperational = true;

        // Maintain proper prototype chain
        Object.setPrototypeOf(this, AppError.prototype);

        // Capture stack trace, excluding constructor call from trace
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
