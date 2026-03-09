const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.mixpanel.events'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {};
    if (args.fromDate) params.fromDate = args.fromDate;
    if (args.toDate) params.toDate = args.toDate;
    if (args.event) params.event = args.event;
    if (args.limit) params.limit = args.limit;

    const response = await context.apiClient.get('/api/mixpanel/events', { params });
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
