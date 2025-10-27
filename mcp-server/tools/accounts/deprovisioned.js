const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Deprovisioned Accounts Tool
 * Get list of deprovisioned accounts
 */
module.exports = {
  name: 'get_deprovisioned_accounts',
  description: 'Get list of accounts that have been deprovisioned. Shows historical data of accounts that are no longer active. Useful for auditing and reporting.',
  
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        description: 'Get accounts deprovisioned since this date (ISO format, optional)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of accounts to return (default: 50, max: 200)',
        default: 50,
        minimum: 1,
        maximum: 200,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const params = {
        since: args.since,
        limit: args.limit || 50,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/deprovisioned-accounts', {
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


