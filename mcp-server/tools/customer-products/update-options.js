const ResponseFormatter = require('../../utils/response-formatter');

/**
 * Get Product Update Options Tool
 * Get available options for product update requests
 */
module.exports = {
  name: 'get_product_update_options',
  description: 'Get available options for creating product update requests including available products, categories, and action types. Useful when building update request forms.',
  
  inputSchema: {
    type: 'object',
    properties: {},
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    
    try {
      // Call API
      const response = await context.apiClient.get('/api/product-update/options');
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


