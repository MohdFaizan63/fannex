import api from './api';

/**
 * postService — all post-related API calls.
 */
const postService = {
    /** GET /posts/creator/:creatorId — paginated list of posts by a creator */
    getByCreator: (creatorId, params) =>
        api.get(`/posts/creator/${creatorId}`, { params }),

    /** GET /posts/:id — single post */
    getById: (id) => api.get(`/posts/${id}`),

    /**
     * POST /posts — create a new post (multipart/form-data).
     * @param {FormData} formData  Must include: one or more 'media' files (up to 10 images
     *                              for album posts, or a single video), optional caption & isLocked
     */
    create: (formData) =>
        api.post('/posts', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    /** DELETE /posts/:id */
    delete: (id) => api.delete(`/posts/${id}`),

    /** POST /posts/:postId/like — toggle like/unlike */
    toggleLike: (postId) => api.post(`/posts/${postId}/like`),

    /** PATCH /posts/:id/caption */
    updateCaption: (id, caption) => api.patch(`/posts/${id}/caption`, { caption }),

    // ── Comments ───────────────────────────────────────────────────────────────

    /** GET /posts/:postId/comments — paginated */
    getComments: (postId, params) =>
        api.get(`/posts/${postId}/comments`, { params }),

    /** POST /posts/:postId/comments */
    addComment: (postId, body) =>
        api.post(`/posts/${postId}/comments`, body),

    /** DELETE /posts/comments/:commentId */
    deleteComment: (commentId) =>
        api.delete(`/posts/comments/${commentId}`),

    /** PATCH /posts/comments/:commentId/hide */
    hideComment: (commentId) =>
        api.patch(`/posts/comments/${commentId}/hide`),

    // ── Creator engagement ─────────────────────────────────────────────────────

    /** GET /posts/engagement/my-posts — creator's post engagement stats */
    getEngagement: (params) =>
        api.get('/posts/engagement/my-posts', { params }),
};

export default postService;
