const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.mixpanel.profiles'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.where) params.where = args.where;
    if (args.outputProperties) params.outputProperties = args.outputProperties;

    const response = await context.apiClient.get('/api/mixpanel/profiles', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
