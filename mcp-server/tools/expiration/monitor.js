const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Expiration Monitor Tool
 * Get products/entitlements expiring within a specified timeframe
 */
module.exports = {
  name: 'get_expiration_monitor',
  description: 'Get products and entitlements that are expiring within a specified timeframe (7-90 days). Useful for proactive customer outreach and renewal planning. Can filter by region and account.',
  
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to look ahead for expirations (default: 30, min: 7, max: 90)',
        default: 30,
        minimum: 7,
        maximum: 90,
      },
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
      
      // Build query parameters
      const params = {
        days: sanitizedArgs.days || 30,
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
        daysAhead: params.days,
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};






