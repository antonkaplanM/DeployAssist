const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Product Update Requests Tool
 * Get list of product update requests with filters
 */
const baseSchema = getToolSchema('preserved.product-updates.list');
module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      validator.validate(args, this.inputSchema);
      const sanitizedArgs = validator.sanitizeInputs(args);

      const params = {
        status: sanitizedArgs.status,
        accountName: sanitizedArgs.accountName,
      };
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await context.apiClient.get('/api/product-update/requests', {
        params,
      });

      const requests = response.data.requests || response.data;
      return formatter.paginated(requests, {
        page: 1,
        limit: Array.isArray(requests) ? requests.length : 0,
        total: response.data.count ?? (Array.isArray(requests) ? requests.length : 0),
        hasMore: false,
      });
    } catch (error) {
      throw error;
    }
  },
};
