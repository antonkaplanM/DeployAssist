const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Recent Package Changes Tool
 * Retrieves most recent package changes
 */
module.exports = {
  name: 'get_recent_package_changes',
  description: 'Get the most recent package changes across all accounts. Shows latest additions, removals, and modifications with timestamps. Useful for monitoring recent activity.',
  
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of changes to return (default: 50, max: 200)',
        default: 50,
        minimum: 1,
        maximum: 200,
      },
      changeType: {
        type: 'string',
        description: 'Filter by change type (optional)',
        enum: ['addition', 'removal', 'modification'],
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
        limit: args.limit || 50,
        changeType: args.changeType,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/analytics/package-changes/recent', {
        params: params,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



