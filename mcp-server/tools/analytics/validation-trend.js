const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.provisioning-analytics.validation-trend'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.months !== undefined) params.months = args.months;
    if (args.enabledRules !== undefined) params.enabledRules = args.enabledRules;

    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/analytics/validation-trend', { params });
    return formatter.success(response.data, {
      executionTime: response.duration,
      months: params.months,
    });
  },
};
