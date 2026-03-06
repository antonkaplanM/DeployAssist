const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

const baseSchema = getToolSchema('derived.expiration.status');

module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();

    try {
      // Call API
      const response = await context.apiClient.get('/api/expiration/status');

      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
    } catch (error) {
      throw error;
    }
  },
};
