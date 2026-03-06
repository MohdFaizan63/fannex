/**
 * Cloudinary CDN URL optimization utility.
 *
 * Injects automatic format / quality transformations into Cloudinary URLs
 * so every image and video is served through the CDN with the best size/quality
 * trade-off for the requesting browser.
 */

const CLOUDINARY_UPLOAD_RE = /(\/upload\/)(v\d+\/)?/;

/**
 * Inject `f_auto,q_auto` into a Cloudinary image URL.
 * Non-Cloudinary URLs pass through unchanged.
 */
const optimizeImageUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com')) return url;

    // Already optimised?
    if (url.includes('f_auto') && url.includes('q_auto')) return url;

    return url.replace(CLOUDINARY_UPLOAD_RE, (_, upload, version) => {
        return `${upload}f_auto,q_auto/${version || ''}`;
    });
};

/**
 * Inject `q_auto` into a Cloudinary video URL.
 * (format auto-negotiation is less useful for video — browsers all support mp4.)
 */
const optimizeVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com')) return url;
    if (url.includes('q_auto')) return url;

    return url.replace(CLOUDINARY_UPLOAD_RE, (_, upload, version) => {
        return `${upload}q_auto/${version || ''}`;
    });
};

/**
 * Generate a JPG thumbnail URL from a Cloudinary video URL.
 * Returns a cropped, auto-quality still image captured at second 0.
 */
const getVideoThumbnailUrl = (videoUrl) => {
    if (!videoUrl || typeof videoUrl !== 'string') return '';
    if (!videoUrl.includes('res.cloudinary.com')) return '';

    // Replace /video/upload/.../<filename>.mp4 → /video/upload/so_0,w_480,h_480,c_fill,f_auto,q_auto/.../<filename>.jpg
    const transformed = videoUrl.replace(CLOUDINARY_UPLOAD_RE, (_, upload, version) => {
        return `${upload}so_0,w_480,h_480,c_fill,f_auto,q_auto/${version || ''}`;
    });

    // Swap video extension → .jpg
    return transformed.replace(/\.\w+$/, '.jpg');
};

/**
 * Optimise an array of media URLs based on their type.
 */
const optimizeMediaUrls = (urls, mediaType) => {
    if (!Array.isArray(urls)) return urls;
    const fn = mediaType === 'video' ? optimizeVideoUrl : optimizeImageUrl;
    return urls.map(fn);
};

module.exports = {
    optimizeImageUrl,
    optimizeVideoUrl,
    getVideoThumbnailUrl,
    optimizeMediaUrls,
};
