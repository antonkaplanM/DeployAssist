const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.mixpanel.insights'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.bookmarkId) params.bookmarkId = args.bookmarkId;

    const response = await context.apiClient.get('/api/mixpanel/insights', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
