const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Packages Tool
 * Get list of packages from the package repository
 */
const baseSchema = getToolSchema('primary.packages.list');
module.exports = {
  ...baseSchema,
  inputSchema: {
    ...baseSchema.inputSchema,
    properties: {
      ...baseSchema.inputSchema.properties,
      limit: {
        type: 'number',
        description: 'Maximum number of packages to return (default: 100, max: 500)',
        default: 100,
        minimum: 1,
        maximum: 500,
      },
    },
  },
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      validator.validate(args, this.inputSchema);
      const sanitizedArgs = validator.sanitizeInputs(args);

      const params = {
        type: sanitizedArgs.type,
        includeDeleted: sanitizedArgs.includeDeleted || false,
        limit: sanitizedArgs.limit || 100,
      };
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await context.apiClient.get('/api/packages', {
        params,
      });

      return formatter.success(response.data, {
        executionTime: response.duration,
        filters: params,
      });
    } catch (error) {
      throw error;
    }
  },
};
