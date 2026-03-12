const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.salesforce.provisioning-list'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const params = {
      pageSize: args.pageSize || 25,
      offset: args.offset || 0,
    };

    if (args.requestType) params.requestType = args.requestType;
    if (args.accountId) params.accountId = args.accountId;
    if (args.status) params.status = args.status;
    if (args.startDate) params.startDate = args.startDate;
    if (args.endDate) params.endDate = args.endDate;
    if (args.search) params.search = args.search;

    const response = await context.apiClient.get('/api/provisioning/requests', { params });

    return formatter.paginated(response.data.records || response.data, {
      page: Math.floor(params.offset / params.pageSize) + 1,
      limit: params.pageSize,
      total: response.data.total || response.data.totalSize || 0,
      hasMore: response.data.hasMore || false,
    });
  },
};
