const CreatorVerification = require('../models/CreatorVerification');
const cloudinary = require('../config/cloudinary');

// Helper: extract secure Cloudinary URL from multer file object
const getFileUrl = (files, fieldname) =>
    files?.[fieldname]?.[0]?.path || null;

const getFilePublicId = (files, fieldname) =>
    files?.[fieldname]?.[0]?.filename || null;

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit KYC verification documents
// @route   POST /api/verification
// @access  Private (creator only)
// ─────────────────────────────────────────────────────────────────────────────
const submitVerification = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Check if a record already exists
        const existing = await CreatorVerification.findOne({ userId });
        if (existing && existing.status === 'pending') {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending verification. Please wait for admin review.',
            });
        }
        if (existing && existing.status === 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Your account is already verified.',
            });
        }

        const { aadhaarNumber, panNumber, bankAccountNumber, ifscCode } = req.body;

        const verification = await CreatorVerification.create({
            userId,
            aadhaarNumber,         // auto-encrypted via schema setter
            panNumber,             // auto-encrypted via schema setter
            bankAccountNumber,     // auto-encrypted via schema setter
            ifscCode,
            aadhaarImageUrl: getFileUrl(req.files, 'aadhaarImage'),
            panImageUrl: getFileUrl(req.files, 'panImage'),
            bankProofImageUrl: getFileUrl(req.files, 'bankProofImage'),
            status: 'pending',
            submittedAt: new Date(),
        });

        res.status(201).json({
            success: true,
            message: 'Verification submitted successfully. We will review within 2–3 business days.',
            data: {
                _id: verification._id,
                status: verification.status,
                submittedAt: verification.submittedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get the logged-in creator's own verification status
// @route   GET /api/verification/me
// @access  Private (creator only)
// ─────────────────────────────────────────────────────────────────────────────
const getMyVerificationStatus = async (req, res, next) => {
    try {
        const verification = await CreatorVerification.findOne({ userId: req.user._id });

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'No verification record found. Please submit your documents.',
            });
        }

        // Return safe fields only — sensitive encrypted fields are NOT exposed
        res.status(200).json({
            success: true,
            data: {
                _id: verification._id,
                status: verification.status,
                rejectionReason: verification.rejectionReason,
                submittedAt: verification.submittedAt,
                approvedAt: verification.approvedAt,
                ifscCode: verification.ifscCode,
                aadhaarImageUrl: verification.aadhaarImageUrl,
                panImageUrl: verification.panImageUrl,
                bankProofImageUrl: verification.bankProofImageUrl,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update (re-submit) verification after rejection
// @route   PATCH /api/verification
// @access  Private (creator only)
// ─────────────────────────────────────────────────────────────────────────────
const updateVerification = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const verification = await CreatorVerification.findOne({ userId });
        if (!verification) {
            return res.status(404).json({ success: false, message: 'No verification record found.' });
        }
        if (verification.status === 'approved') {
            return res.status(400).json({ success: false, message: 'Your account is already verified.' });
        }
        if (verification.status === 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Verification is already pending review. Please wait.',
            });
        }

        // Build update object from body fields
        const updates = {};
        if (req.body.aadhaarNumber) updates.aadhaarNumber = req.body.aadhaarNumber;
        if (req.body.panNumber) updates.panNumber = req.body.panNumber;
        if (req.body.bankAccountNumber) updates.bankAccountNumber = req.body.bankAccountNumber;
        if (req.body.ifscCode) updates.ifscCode = req.body.ifscCode;

        // Replace document images if re-uploaded
        if (req.files?.aadhaarImage) {
            // Destroy old Cloudinary asset
            if (verification.aadhaarImageUrl) {
                await cloudinary.uploader.destroy(
                    getFilePublicId(req.files, 'aadhaarImage'),
                    { resource_type: 'image', invalidate: true }
                );
            }
            updates.aadhaarImageUrl = getFileUrl(req.files, 'aadhaarImage');
        }
        if (req.files?.panImage) {
            updates.panImageUrl = getFileUrl(req.files, 'panImage');
        }
        if (req.files?.bankProofImage) {
            updates.bankProofImageUrl = getFileUrl(req.files, 'bankProofImage');
        }

        // Reset to pending on re-submission
        updates.status = 'pending';
        updates.rejectionReason = null;
        updates.submittedAt = new Date();
        updates.approvedAt = null;
        updates.approvedBy = null;

        const updated = await CreatorVerification.findOneAndUpdate(
            { userId },
            updates,
            { returnDocument: 'after', runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Verification re-submitted. We will review within 2–3 business days.',
            data: {
                _id: updated._id,
                status: updated.status,
                submittedAt: updated.submittedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { submitVerification, getMyVerificationStatus, updateVerification };
