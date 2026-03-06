const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.salesforce.validation-errors'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.timeFrame !== undefined) params.timeFrame = args.timeFrame;

    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await context.apiClient.get('/api/validation/errors', { params });
    return formatter.success(response.data, {
      executionTime: response.duration,
      filters: params,
    });
  },
};
