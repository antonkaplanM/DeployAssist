const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Search Provisioning Requests Tool
 * Search deployment/provisioning requests with filters
 */
module.exports = {
  name: 'search_provisioning_requests',
  description: 'Search deployment provisioning requests (Technical Team Requests) with flexible filters. Can search by account name, request ID, status, or any text content. Returns paginated results.',
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for account name, request ID, or any text content',
        maxLength: 500,
      },
      status: {
        type: 'string',
        description: 'Filter by request status (optional)',
        enum: ['pending', 'completed', 'failed', 'in_progress'],
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
      
      // Sanitize query string
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Set defaults
      const params = {
        query: sanitizedArgs.query || '',
        status: sanitizedArgs.status,
        page: sanitizedArgs.page || 1,
        limit: sanitizedArgs.limit || 50,
      };
      
      // Call API
      const response = await context.apiClient.get('/api/provisioning/search', {
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






