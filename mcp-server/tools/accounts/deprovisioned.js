const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

const baseSchema = getToolSchema('derived.ghost-accounts.deprovisioned');

module.exports = {
  ...baseSchema,
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);

      // Route handler uses daysBack (number, default 30), NOT since. No limit.
      const params = {
        daysBack: args.daysBack ?? 30,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      // Call API - canonical endpoint is /api/ghost-accounts/deprovisioned
      const response = await context.apiClient.get('/api/ghost-accounts/deprovisioned', {
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
