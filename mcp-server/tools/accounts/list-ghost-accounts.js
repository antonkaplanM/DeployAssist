const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Ghost Accounts Tool
 * Get list of ghost accounts (accounts with expired products)
 */
module.exports = {
  name: 'list_ghost_accounts',
  description: 'Get list of ghost accounts - customer accounts with expired or expiring products that may need cleanup. Shows accounts potentially requiring deprovisioning or renewal outreach.',
  
  inputSchema: {
    type: 'object',
    properties: {
      includeReviewed: {
        type: 'boolean',
        description: 'Include accounts that have already been reviewed (default: false)',
        default: false,
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
        includeReviewed: args.includeReviewed || false,
        limit: args.limit || 50,
      };
      
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


