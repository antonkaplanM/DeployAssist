const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Package Changes By Account Tool
 * Retrieves package changes grouped by account
 */
module.exports = {
  name: 'get_package_changes_by_account',
  description: 'Get package changes grouped by account. Shows which customer accounts have had the most package activity. Useful for account-specific analysis and customer success.',
  
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of accounts to return (default: 20, max: 100)',
        default: 20,
        minimum: 1,
        maximum: 100,
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
        limit: args.limit || 20,
      };
      
      // Call API
      const response = await context.apiClient.get('/api/analytics/package-changes/by-account', {
        params: params,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        limit: params.limit,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


