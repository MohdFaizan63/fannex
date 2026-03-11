/**
 * Reusable pagination helper for Mongoose models.
 *
 * Usage:
 *   const result = await paginate(Post, { creatorId }, {
 *       page: 1, limit: 10, sort: '-createdAt',
 *       searchField: 'caption', searchQuery: 'hello',
 *       useTextSearch: true,   // Use $text index instead of $regex (much faster)
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
 * @param {string} [options.searchField]        - Model field to run regex search on (non-text-index)
 * @param {string} [options.searchQuery]        - Search term
 * @param {boolean} [options.useTextSearch]     - Use $text index search (must have text index on model)
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
    const searchQuery = options.searchQuery?.trim();

    if (searchQuery) {
        if (options.useTextSearch) {
            // Fast: uses MongoDB text index (must be defined on the model)
            combinedFilter.$text = { $search: searchQuery };
        } else if (options.searchField) {
            // Fallback: regex (slower, but works without text index)
            combinedFilter[options.searchField] = {
                $regex: searchQuery,
                $options: 'i',   // case-insensitive
            };
        }
    }

    // When using text search, add textScore projection for relevance sorting
    const projection = (options.useTextSearch && searchQuery)
        ? { score: { $meta: 'textScore' } }
        : {};

    // Override sort to textScore when searching, unless caller explicitly set sort
    const effectiveSortObj = (options.useTextSearch && searchQuery && !options.sort)
        ? { score: { $meta: 'textScore' } }
        : sortObj;

    // ── Query ───────────────────────────────────────────────────────────────────
    let query = Model.find(combinedFilter, projection)
        .sort(effectiveSortObj)
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
