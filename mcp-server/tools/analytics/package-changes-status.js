const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Package Changes Status Tool
 * Retrieves status of package changes analysis
 */
module.exports = {
  name: 'get_package_changes_status',
  description: 'Get status of the package changes analysis system including last refresh time, total changes tracked, and analysis health. Useful for system monitoring.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/analytics/package-changes/status');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



