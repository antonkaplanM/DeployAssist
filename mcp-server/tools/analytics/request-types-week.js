const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.provisioning-analytics.request-types'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.months !== undefined) params.months = args.months;

    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/analytics/request-types-week', { params });
    return formatter.success(response.data, {
      executionTime: response.duration,
    });
  },
};
