const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Package Stats Tool
 * Get summary statistics about the package repository
 */
module.exports = {
  name: 'get_package_stats',
  description: 'Get summary statistics about the package repository including total packages, types breakdown, most used packages, and repository health metrics.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/packages/summary/stats');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


