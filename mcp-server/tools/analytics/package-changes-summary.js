const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Package Changes Summary Tool
 * Retrieves summary statistics of package changes
 */
module.exports = {
  name: 'get_package_changes_summary',
  description: 'Get summary statistics of package changes including total changes, additions, removals, and modifications. Useful for understanding package management trends.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/analytics/package-changes/summary');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



