const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.package-changes.recent'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.limit !== undefined) params.limit = args.limit;

    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/analytics/package-changes/recent', { params });
    return formatter.success(response.data, {
      executionTime: response.duration,
      filters: params,
    });
  },
};
