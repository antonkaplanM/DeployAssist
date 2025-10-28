const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Search Jira Initiatives Tool
 * Search Jira initiatives and issues
 */
module.exports = {
  name: 'search_jira_initiatives',
  description: 'Search Jira initiatives and issues using JQL (Jira Query Language) or simple filters. Returns matching issues with key details. Useful for tracking projects and initiatives.',
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (JQL or simple text search)',
        maxLength: 500,
      },
      status: {
        type: 'string',
        description: 'Filter by status (optional)',
        maxLength: 100,
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee (optional)',
        maxLength: 255,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50, max: 100)',
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
        query: sanitizedArgs.query,
        status: sanitizedArgs.status,
        assignee: sanitizedArgs.assignee,
        limit: sanitizedArgs.limit || 50,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API (POST to handle longer queries)
      const response = await context.apiClient.post('/api/jira/initiatives', params);
      
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



