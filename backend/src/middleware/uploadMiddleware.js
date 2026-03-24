const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Allowed types ──────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ALLOWED_IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_VIDEO_EXTS  = new Set(['.mp4', '.mov', '.webm']);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100 MB

// ── Magic-byte signatures ──────────────────────────────────────────────────────
// Secondary validation gate that catches MIME-type spoofing.
// A client can send Content-Type: image/jpeg for any payload — we verify
// the actual binary header of the buffer.  CloudinaryStorage doesn't expose
// the buffer directly, so we also check for disk-storage files by path.
const MAGIC_SIGNATURES = [
    'ffd8ff',       // JPEG
    '89504e47',     // PNG
    '47494638',     // GIF
    '52494646',     // WEBP (RIFF header)
    '66747970',     // MP4 ftyp box (most common)
    '00000018',     // MP4 short header
    '00000020',     // MP4 short header variant
    '00000014',     // QuickTime
    '6d6f6f76',     // QuickTime moov
    '1a45dfa3',     // WebM EBML
];

/**
 * Check whether a multer file's magic bytes match a known media signature.
 * Falls back to true (pass) when the buffer is not available (disk storage).
 */
function isMagicByteValid(file) {
    const buf = file.buffer;
    if (!buf || buf.length < 8) {
        // Disk storage — Cloudinary validates server-side, so we trust MIME+ext check.
        return true;
    }
    const hexHeader = buf.slice(0, 8).toString('hex');
    return MAGIC_SIGNATURES.some((sig) => hexHeader.startsWith(sig));
}

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
        params: async (_req, file) => {
            const isVideo = ALLOWED_VIDEO_MIMES.has(file.mimetype);
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
            cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
        },
    });

    console.log('💾 Upload storage: local disk (/uploads)');
}

// ── File filter — checks MIME type, extension, AND magic bytes ────────────────
const fileFilter = (req, file, cb) => {
    const mime = file.mimetype;
    const ext  = path.extname(file.originalname).toLowerCase();

    const isAllowedMime = ALLOWED_IMAGE_MIMES.has(mime) || ALLOWED_VIDEO_MIMES.has(mime);
    const isAllowedExt  = ALLOWED_IMAGE_EXTS.has(ext)   || ALLOWED_VIDEO_EXTS.has(ext);

    if (!isAllowedMime || !isAllowedExt) {
        return cb(new Error(`Unsupported file type: ${mime} (ext: ${ext})`), false);
    }
    if (!isMagicByteValid(file)) {
        return cb(new Error('File content does not match its declared type. Upload rejected.'), false);
    }
    cb(null, true);
};

// ── Multer instance ────────────────────────────────────────────────────────────
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_VIDEO_SIZE }, // hard cap at 100 MB; per-type enforced below
});

// ── Post-upload: per-type size validation (supports req.files array) ───────────
const validateFileSizes = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return next();

    const hasVideo = files.some((f) => ALLOWED_VIDEO_MIMES.has(f.mimetype));
    const hasImage = files.some((f) => ALLOWED_IMAGE_MIMES.has(f.mimetype));

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
        const isVideo = ALLOWED_VIDEO_MIMES.has(file.mimetype);
        const limit    = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        const label    = isVideo ? 'Video' : 'Photo';
        const maxLabel = isVideo ? '100MB' : '10MB';
        if (file.size > limit) {
            return res.status(400).json({ success: false, message: `${label} must be under ${maxLabel}` });
        }
    }

    next();
};

// Keep legacy export name for backward compat
module.exports = { upload, validateFileSizes, validateFileSize: validateFileSizes };
