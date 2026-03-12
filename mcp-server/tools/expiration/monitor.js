const { getToolSchema } = require('../../../config/report-data-sources');
const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

const baseSchema = getToolSchema('derived.expiration.monitor');

module.exports = {
  ...baseSchema,
  inputSchema: {
    ...baseSchema.inputSchema,
    properties: {
      ...baseSchema.inputSchema.properties,
      // Extra MCP-only params not in the canonical schema
      region: {
        type: 'string',
        description: 'Filter by region (optional)',
        enum: ['NAM', 'EMEA', 'APAC', 'LATAM'],
      },
      accountName: {
        type: 'string',
        description: 'Filter by specific account name (optional)',
        maxLength: 255,
      },
      productName: {
        type: 'string',
        description: 'Filter by product name (optional)',
        maxLength: 255,
      },
      sortBy: {
        type: 'string',
        description: 'Sort results by field (default: expirationDate)',
        enum: ['expirationDate', 'accountName', 'productName', 'region'],
        default: 'expirationDate',
      },
    },
  },
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();

    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);

      // Sanitize inputs
      const sanitizedArgs = validator.sanitizeInputs(args);

      // Build query parameters - route handler uses expirationWindow (default 30), NOT days
      const params = {
        expirationWindow: sanitizedArgs.expirationWindow ?? 30,
        showExtended: sanitizedArgs.showExtended,
        region: sanitizedArgs.region,
        accountName: sanitizedArgs.accountName,
        productName: sanitizedArgs.productName,
        sortBy: sanitizedArgs.sortBy || 'expirationDate',
      };

      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      // Call API
      const response = await context.apiClient.get('/api/expiration/monitor', {
        params: params,
      });

      // Format response
      const expirations = response.data.expirations || response.data;

      return formatter.success(expirations, {
        executionTime: response.duration,
        count: Array.isArray(expirations) ? expirations.length : 0,
        daysAhead: params.expirationWindow,
        filters: params,
      });
    } catch (error) {
      throw error;
    }
  },
};
