const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Request Types This Week Tool
 * Retrieves breakdown of request types for the current week
 */
module.exports = {
  name: 'get_request_types_week',
  description: 'Get breakdown of Technical Team Request types for the current week. Shows distribution of different request types (New License, Product Update, etc.) to understand workload patterns.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/analytics/request-types-week');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


