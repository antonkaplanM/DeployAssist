const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Customer Products Tool
 * Get all active products for customers, organized by region and category
 */
const baseSchema = getToolSchema('primary.salesforce.customer-products');
module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      validator.validate(args, this.inputSchema);
      const sanitizedArgs = validator.sanitizeInputs(args);

      const params = { account: sanitizedArgs.account };
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await context.apiClient.get('/api/customer-products', {
        params,
      });

      const products = response.data.products || response.data;

      return formatter.success(products, {
        executionTime: response.duration,
        count: Array.isArray(products) ? products.length : 0,
        filters: params,
      });
    } catch (error) {
      throw error;
    }
  },
};
