const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

const baseSchema = getToolSchema('derived.ghost-accounts.list');

module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);

      // Route handler uses isReviewed (NOT includeReviewed) and accountSearch. No limit.
      const params = {
        isReviewed: args.isReviewed,
        accountSearch: args.accountSearch,
        expiryBefore: args.expiryBefore,
        expiryAfter: args.expiryAfter,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      // Call API
      const response = await context.apiClient.get('/api/ghost-accounts', {
        params: params,
      });

      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        filters: params,
      });
    } catch (error) {
      throw error;
    }
  },
};
