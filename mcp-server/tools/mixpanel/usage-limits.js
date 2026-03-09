const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.mixpanel.usage-limits'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.days) params.days = args.days;
    if (args.refresh) params.refresh = 'true';

    const response = await context.apiClient.get('/api/mixpanel/usage-limits', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
