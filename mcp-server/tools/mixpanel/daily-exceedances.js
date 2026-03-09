const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.mixpanel.daily-exceedances'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.days) params.days = args.days;

    const response = await context.apiClient.get('/api/mixpanel/daily-exceedances', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
