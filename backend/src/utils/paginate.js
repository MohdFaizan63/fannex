/**
 * Reusable pagination helper for Mongoose models.
 *
 * Usage:
 *   const result = await paginate(Post, { creatorId }, {
 *       page: 1, limit: 10, sort: '-createdAt',
 *       searchField: 'caption', searchQuery: 'hello',
 *       populate: 'creatorId',
 *   });
 *
 * Returns:
 *   {
 *     results:      array of documents,
 *     page:         current page number,
 *     totalPages:   total pages,
 *     totalResults: total matching documents,
 *   }
 *
 * @param {import('mongoose').Model} Model
 * @param {object} filter         - Base Mongoose filter (applied before search)
 * @param {object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string} [options.sort='-createdAt']  - Comma-separated sort fields, e.g. '-createdAt,name'
 * @param {string} [options.searchField]        - Model field to run regex search on
 * @param {string} [options.searchQuery]        - Search term
 * @param {string|object|Array} [options.populate] - Passed directly to .populate()
 * @param {string} [options.select]             - Fields to select
 * @returns {Promise<{results, page, totalPages, totalResults}>}
 */
const paginate = async (Model, filter = {}, options = {}) => {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20)); // cap at 100
    const skip = (page - 1) * limit;

    // ── Sort ────────────────────────────────────────────────────────────────────
    // Convert comma-separated string 'name,-createdAt' → Mongoose sort object
    const sortObj = {};
    const sortStr = options.sort || '-createdAt';
    sortStr.split(',').forEach((field) => {
        const trimmed = field.trim();
        if (trimmed.startsWith('-')) {
            sortObj[trimmed.slice(1)] = -1;
        } else {
            sortObj[trimmed] = 1;
        }
    });

    // ── Search ──────────────────────────────────────────────────────────────────
    const combinedFilter = { ...filter };
    if (options.searchField && options.searchQuery && options.searchQuery.trim()) {
        combinedFilter[options.searchField] = {
            $regex: options.searchQuery.trim(),
            $options: 'i',   // case-insensitive
        };
    }

    // ── Query ───────────────────────────────────────────────────────────────────
    let query = Model.find(combinedFilter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit);

    if (options.populate) {
        // Support string, object, or array of populates
        const populations = Array.isArray(options.populate)
            ? options.populate
            : [options.populate];
        populations.forEach((p) => { query = query.populate(p); });
    }

    if (options.select) {
        query = query.select(options.select);
    }

    // Run query and count in parallel for performance
    const [results, totalResults] = await Promise.all([
        query.lean(),
        Model.countDocuments(combinedFilter),
    ]);

    return {
        results,
        page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

module.exports = paginate;
