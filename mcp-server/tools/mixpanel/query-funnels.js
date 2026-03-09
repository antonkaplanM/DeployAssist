const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.mixpanel.funnels'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.funnelId) params.funnelId = args.funnelId;

    const response = await context.apiClient.get('/api/mixpanel/funnels', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
