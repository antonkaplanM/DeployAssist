const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Product Update Requests Tool
 * Get list of product update requests with filters
 */
module.exports = {
  name: 'get_product_update_requests',
  description: 'Get list of product update requests with optional filters. Shows pending, approved, and completed requests. Useful for tracking product change workflows.',
  
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by request status (optional)',
        enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      },
      accountName: {
        type: 'string',
        description: 'Filter by account name (optional)',
        maxLength: 255,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
        default: 1,
        minimum: 1,
      },
      limit: {
        type: 'number',
        description: 'Number of results per page (default: 50, max: 100)',
        default: 50,
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
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      const params = {
        status: sanitizedArgs.status,
        accountName: sanitizedArgs.accountName,
        page: sanitizedArgs.page || 1,
        limit: sanitizedArgs.limit || 50,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/product-update/requests', {
        params: params,
      });
      
      // Format paginated response
      return formatter.paginated(response.data.requests || response.data, {
        page: params.page,
        limit: params.limit,
        total: response.data.total || response.data.length,
        hasMore: response.data.hasMore || false,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



