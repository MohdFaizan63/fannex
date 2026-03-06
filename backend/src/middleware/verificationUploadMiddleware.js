const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Allowed MIME types for KYC documents
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
];

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per document

// Cloudinary private folder storage (access_mode: 'authenticated' restricts public access)
const documentStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'fannex/kyc-documents',
        resource_type: 'image',         // Cloudinary treats PDFs as 'image' resource type
        allowed_formats: ALLOWED_FORMATS,
        access_mode: 'authenticated',   // Private — requires signed URL to access
        public_id: `${req.user._id}_${file.fieldname}_${Date.now()}`,
    }),
});

// MIME type filter
const documentFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(`Invalid file type for ${file.fieldname}. Only JPG, PNG, and PDF are allowed.`),
            false
        );
    }
};

// Accept exactly 3 named fields: aadhaarImage, panImage, bankProofImage
const documentUpload = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: { fileSize: MAX_FILE_SIZE },
}).fields([
    { name: 'aadhaarImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'bankProofImage', maxCount: 1 },
]);

// Post-upload: ensure all 3 documents were provided for new submissions
const requireAllDocuments = (req, res, next) => {
    // On update (PATCH), we allow partial re-uploads — skip strict check
    if (req.method === 'PATCH') return next();

    const required = ['aadhaarImage', 'panImage', 'bankProofImage'];
    const missing = required.filter((field) => !req.files?.[field]);

    if (missing.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required documents: ${missing.join(', ')}`,
        });
    }
    next();
};

module.exports = { documentUpload, requireAllDocuments };

// ── Memory-storage upload for /creator/apply ──────────────────────────────────
// Stores files in RAM (req.files) — no Cloudinary needed for onboarding flow.
const applyUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: documentFilter,
    limits: { fileSize: MAX_FILE_SIZE },
}).fields([
    { name: 'aadhaarImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'bankProofImage', maxCount: 1 },
]);

// Re-export with applyUpload added
module.exports = { documentUpload, requireAllDocuments, applyUpload };
