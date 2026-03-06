const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('derived.package-changes.by-account'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.timeFrame !== undefined) params.timeFrame = args.timeFrame;
    if (args.limit !== undefined) params.limit = args.limit;

    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/analytics/package-changes/by-account', { params });
    return formatter.success(response.data, {
      executionTime: response.duration,
      limit: params.limit,
    });
  },
};
