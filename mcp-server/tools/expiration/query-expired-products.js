const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

const baseSchema = getToolSchema('derived.expiration.expired-products');

module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);

      // Sanitize inputs
      const sanitizedArgs = validator.sanitizeInputs(args);

      // Build query parameters - canonical schema: category, accountName, excludeProduct, limit, groupByAccount
      const params = {
        category: sanitizedArgs.category,
        accountName: sanitizedArgs.accountName,
        excludeProduct: sanitizedArgs.excludeProduct,
        limit: sanitizedArgs.limit ?? 100,
        groupByAccount: sanitizedArgs.groupByAccount !== false,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      // Call API
      const response = await context.apiClient.get('/api/expiration/expired-products', {
        params: params,
      });

      // Format response
      const data = response.data;

      return formatter.success(data, {
        executionTime: response.duration,
        count: data.accounts ? data.accounts.length : (Array.isArray(data.products) ? data.products.length : 0),
        filters: params,
      });
    } catch (error) {
      throw error;
    }
  },
};
