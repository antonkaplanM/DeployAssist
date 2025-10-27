const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Provisioning Requests Tool
 * List all provisioning requests with pagination
 */
module.exports = {
  name: 'list_provisioning_requests',
  description: 'List all provisioning requests with pagination. Different from search - returns all requests without filtering. Supports pagination for large datasets.',
  
  inputSchema: {
    type: 'object',
    properties: {
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
      
      const params = {
        page: args.page || 1,
        limit: args.limit || 50,
      };
      
      // Call API
      const response = await context.apiClient.get('/api/provisioning/requests', {
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


