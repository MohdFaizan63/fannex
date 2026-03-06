const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Allowed types ──────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB
const MAX_FILES = 10;                       // max photos per album

// ── Decide storage backend ─────────────────────────────────────────────────────
const hasCloudinary =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

let storage;

if (hasCloudinary) {
    // ── Cloudinary (production) ──────────────────────────────────────────────
    const cloudinary = require('../config/cloudinary');
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    storage = new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => {
            const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
            return {
                folder: `fannex/${isVideo ? 'videos' : 'images'}`,
                resource_type: isVideo ? 'video' : 'image',
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm'],
                transformation: isVideo
                    ? [{ quality: 'auto' }]
                    : [{ quality: 'auto', fetch_format: 'auto' }],
            };
        },
    });

    console.log('📦 Upload storage: Cloudinary');
} else {
    // ── Local disk (development / no Cloudinary) ─────────────────────────────
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    storage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
            cb(null, `${unique}${path.extname(file.originalname)}`);
        },
    });

    console.log('💾 Upload storage: local disk (/uploads) — add Cloudinary keys to .env for cloud storage');
}

// ── File filter ────────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
};

// ── Multer instance ────────────────────────────────────────────────────────────
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_VIDEO_SIZE },
});

// ── Post-upload: per-type size validation (supports req.files array) ───────────
const validateFileSizes = (req, res, next) => {
    // Support both single-file and multi-file uploads
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return next();

    // Check if the upload mixes videos and images
    const hasVideo = files.some((f) => ALLOWED_VIDEO_TYPES.includes(f.mimetype));
    const hasImage = files.some((f) => ALLOWED_IMAGE_TYPES.includes(f.mimetype));

    if (hasVideo && files.length > 1) {
        return res.status(400).json({
            success: false,
            message: 'Video posts can only contain a single video file. Albums support images only.',
        });
    }

    if (hasVideo && hasImage) {
        return res.status(400).json({
            success: false,
            message: 'Cannot mix images and videos in a single post.',
        });
    }

    for (const file of files) {
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
        const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        const label = isVideo ? 'Video' : 'Photo';
        const maxLabel = isVideo ? '100MB' : '10MB';

        if (file.size > limit) {
            return res.status(400).json({
                success: false,
                message: `${label} must be under ${maxLabel}`,
            });
        }
    }

    next();
};

// Keep legacy export name for backward compat
module.exports = { upload, validateFileSizes, validateFileSize: validateFileSizes };
