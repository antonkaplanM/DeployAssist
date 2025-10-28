const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Filter Options Tool
 * Get available filter options for provisioning requests
 */
module.exports = {
  name: 'get_provisioning_filter_options',
  description: 'Get available filter options for provisioning requests including statuses, request types, and other filterable fields. Useful for building dynamic filters.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/provisioning/filter-options');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



