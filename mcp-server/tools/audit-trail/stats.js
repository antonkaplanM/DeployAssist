const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Audit Stats Tool
 * Retrieve PS audit trail statistics
 */
const baseSchema = getToolSchema('preserved.audit-trail.stats');
module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();

    try {
      const response = await context.apiClient.get('/api/audit-trail/stats');

      return formatter.success(response.data, {
        executionTime: response.duration,
      });
    } catch (error) {
      throw error;
    }
  },
};
