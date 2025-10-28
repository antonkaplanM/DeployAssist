const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Refresh Expiration Data Tool
 * Manually trigger refresh of expiration monitor data (WRITE OPERATION)
 */
module.exports = {
  name: 'refresh_expiration_data',
  description: 'Manually trigger a refresh of expiration monitor data from Salesforce. This is a WRITE operation that fetches current entitlement data. Use sparingly as it queries Salesforce.',
  
  inputSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Force refresh even if recently refreshed (default: false)',
        default: false,
      },
    },
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API (POST request)
      const response = await context.apiClient.post('/api/expiration/refresh', {
        force: args.force || false,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'refresh_triggered',
        forced: args.force || false,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



