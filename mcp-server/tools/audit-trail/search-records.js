const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Search PS Records Tool
 * Search Professional Services audit records
 */
const baseSchema = getToolSchema('preserved.audit-trail.search');
module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      validator.validate(args, this.inputSchema);
      const sanitizedArgs = validator.sanitizeInputs(args);

      const params = {
        q: sanitizedArgs.q,
        status: sanitizedArgs.status,
      };
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await context.apiClient.get('/api/audit-trail/search', {
        params,
      });

      const results = response.data.results || response.data;
      return formatter.paginated(results, {
        page: 1,
        limit: Array.isArray(results) ? results.length : 0,
        total: Array.isArray(results) ? results.length : 0,
        hasMore: false,
      });
    } catch (error) {
      throw error;
    }
  },
};
