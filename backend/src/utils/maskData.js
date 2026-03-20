/**
 * Data Masking Utilities
 * Transforms sensitive verification fields before sending to frontend.
 * Raw decrypted values are NEVER exposed via API.
 */

// Show only last 4 digits of Aadhaar: "XXXX XXXX 1234"
const maskAadhaar = (aadhaar) => {
    if (!aadhaar) return null;
    const digits = String(aadhaar).replace(/\D/g, '');
    return `XXXX XXXX ${digits.slice(-4)}`;
};

// Show only last 4 digits of PAN (PAN is 10 chars: ABCDE1234F → XXXXX1234X)
const maskPan = (pan) => {
    if (!pan) return null;
    const p = String(pan).toUpperCase();
    return `${p.slice(0, 2)}XXX${p.slice(5, 9)}X`;
};

// Bank account number — fully hidden
const maskBankAccount = () => '••••••••';

// Build a safe verification object for API responses
const maskVerificationData = (verification) => {
    if (!verification) return null;

    // verification.aadhaarNumber is auto-decrypted by Mongoose getter
    return {
        _id: verification._id,
        userId: verification.userId,
        status: verification.status,
        rejectionReason: verification.rejectionReason,
        submittedAt: verification.submittedAt,
        approvedAt: verification.approvedAt,
        approvedBy: verification.approvedBy,
        ifscCode: verification.ifscCode,
        accountHolderName: verification.accountHolderName || '',
        bankName: verification.bankName || '',

        // Masked sensitive fields
        aadhaarNumber: maskAadhaar(verification.aadhaarNumber),
        panNumber: maskPan(verification.panNumber),
        bankAccountNumber: maskBankAccount(),   // always fully hidden

        // Image URLs (authenticated Cloudinary links)
        aadhaarImageUrl: verification.aadhaarImageUrl,
        panImageUrl: verification.panImageUrl,
        bankProofImageUrl: verification.bankProofImageUrl,
    };
};

module.exports = { maskAadhaar, maskPan, maskBankAccount, maskVerificationData };
