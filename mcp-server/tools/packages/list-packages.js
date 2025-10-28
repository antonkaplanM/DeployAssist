const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * List Packages Tool
 * Get list of packages from the package repository
 */
module.exports = {
  name: 'list_packages',
  description: 'Get list of packages from the package repository. Shows available software packages with metadata, types, and relationships. Useful for understanding product catalog.',
  
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Filter by package type (optional)',
        maxLength: 100,
      },
      includeDeleted: {
        type: 'boolean',
        description: 'Include deleted packages (default: false)',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of packages to return (default: 100, max: 500)',
        default: 100,
        minimum: 1,
        maximum: 500,
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
        type: sanitizedArgs.type,
        includeDeleted: sanitizedArgs.includeDeleted || false,
        limit: sanitizedArgs.limit || 100,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/packages', {
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



