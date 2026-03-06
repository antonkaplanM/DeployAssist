const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Package Stats Tool
 * Get summary statistics about the package repository
 */
const baseSchema = getToolSchema('primary.packages.stats');
module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();

    try {
      const response = await context.apiClient.get('/api/packages/summary/stats');

      return formatter.success(response.data, {
        executionTime: response.duration,
      });
    } catch (error) {
      throw error;
    }
  },
};
