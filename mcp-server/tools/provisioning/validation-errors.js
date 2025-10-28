const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Validation Errors Tool
 * Get current validation errors in provisioning requests
 */
module.exports = {
  name: 'get_validation_errors',
  description: 'Get current validation errors in provisioning requests. Shows requests that failed data validation with error details. Useful for data quality monitoring and cleanup.',
  
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of errors to return (default: 50, max: 200)',
        default: 50,
        minimum: 1,
        maximum: 200,
      },
      severity: {
        type: 'string',
        description: 'Filter by severity level (optional)',
        enum: ['error', 'warning', 'info'],
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
        severity: args.severity,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/validation/errors', {
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



