import { useState, useCallback } from 'react';

/**
 * Generic data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, execute } = useFetch(postService.getByCreator);
 *   useEffect(() => { execute(creatorId, { page: 1 }); }, [creatorId]);
 */
export function useFetch(asyncFn) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = useCallback(async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const response = await asyncFn(...args);
            setData(response.data);
            return response.data;
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Something went wrong';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [asyncFn]);

    return { data, loading, error, execute };
}

/**
 * Pagination state helper.
 *
 * Usage:
 *   const { page, limit, setPage } = usePagination();
 */
export function usePagination(initialPage = 1, initialLimit = 20) {
    const [page, setPage] = useState(initialPage);
    const [limit, setLimit] = useState(initialLimit);

    const nextPage = () => setPage((p) => p + 1);
    const prevPage = () => setPage((p) => Math.max(1, p - 1));
    const reset = () => setPage(1);

    return { page, limit, setPage, setLimit, nextPage, prevPage, reset };
}
