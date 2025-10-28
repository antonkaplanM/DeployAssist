const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Expiration Status Tool
 * Get status of expiration monitor system
 */
module.exports = {
  name: 'get_expiration_status',
  description: 'Get status of the expiration monitor system including last refresh time, total entitlements tracked, and system health. Useful for monitoring and troubleshooting.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/expiration/status');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



