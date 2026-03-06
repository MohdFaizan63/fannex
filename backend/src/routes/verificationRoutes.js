const express = require('express');
const router = express.Router();
const {
    submitVerification,
    getMyVerificationStatus,
    updateVerification,
} = require('../controllers/verificationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { documentUpload, requireAllDocuments } = require('../middleware/verificationUploadMiddleware');
const { validate } = require('../validators/validate');
const { submitVerificationSchema, updateVerificationSchema } = require('../validators/verificationValidators');

// All routes: logged-in creators only
router.use(protect);
router.use(authorize('creator'));

// Submit new verification (all 3 docs + full body required)
router.post(
    '/',
    documentUpload,
    requireAllDocuments,
    validate(submitVerificationSchema),   // validate text fields after multer populates req.body
    submitVerification
);

// Check own verification status
router.get('/me', getMyVerificationStatus);

// Re-submit after rejection (partial uploads + partial body allowed)
router.patch(
    '/',
    documentUpload,
    validate(updateVerificationSchema),
    updateVerification
);

module.exports = router;

