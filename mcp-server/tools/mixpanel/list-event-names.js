const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

module.exports = {
  ...getToolSchema('primary.mixpanel.event-names'),

  async execute(args, context) {
    const formatter = new ResponseFormatter();

    const response = await context.apiClient.get('/api/mixpanel/event-names');
    return formatter.success(response.data, { executionTime: response.duration });
  },
};
