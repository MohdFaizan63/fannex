import api from './api';

const insightsService = {
    /** Profile view analytics — range: 'week' | 'month' | 'year' */
    getProfileViews: (range = 'week') =>
        api.get('/creator/insights/profile-views', { params: { range } }),

    /** Earnings analytics — range: 'week' | 'month' | 'year' */
    getEarnings: (range = 'week') =>
        api.get('/creator/insights/earnings', { params: { range } }),

    /** Overview summary stats */
    getOverview: () =>
        api.get('/creator/insights/overview'),
};

export default insightsService;
