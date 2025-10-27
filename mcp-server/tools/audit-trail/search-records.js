const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Search PS Records Tool
 * Search Professional Services audit records
 */
module.exports = {
  name: 'search_ps_records',
  description: 'Search Professional Services audit records with flexible filters. Can search by PS record name, account, status, or other criteria. Returns complete audit trail for matching records.',
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for PS record name, account name, or other fields',
        maxLength: 500,
      },
      status: {
        type: 'string',
        description: 'Filter by PS record status (optional)',
        maxLength: 100,
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
        query: sanitizedArgs.query || '',
        status: sanitizedArgs.status,
        page: sanitizedArgs.page || 1,
        limit: sanitizedArgs.limit || 50,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/audit-trail/search', {
        params: params,
      });
      
      // Format paginated response
      return formatter.paginated(response.data.records || response.data, {
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


