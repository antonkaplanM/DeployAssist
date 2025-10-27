const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Provisioning Removals Tool
 * Get product removal requests from provisioning system
 */
module.exports = {
  name: 'get_provisioning_removals',
  description: 'Get product removal requests from the provisioning system. Shows products being deprovisioned or removed from customer accounts. Useful for tracking churn and deprovisioning activity.',
  
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of removals to return (default: 50, max: 200)',
        default: 50,
        minimum: 1,
        maximum: 200,
      },
      accountName: {
        type: 'string',
        description: 'Filter by account name (optional)',
        maxLength: 255,
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
        limit: sanitizedArgs.limit || 50,
        accountName: sanitizedArgs.accountName,
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/provisioning/removals', {
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


