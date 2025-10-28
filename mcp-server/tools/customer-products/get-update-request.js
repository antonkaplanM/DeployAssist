const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Product Update Request Tool
 * Get details of a specific product update request
 */
module.exports = {
  name: 'get_product_update_request',
  description: 'Get detailed information about a specific product update request by identifier. Shows complete request details, status, and history.',
  
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Request identifier (ID or request number)',
        minLength: 1,
        maxLength: 100,
      },
    },
    required: ['identifier'],
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Call API
      const response = await context.apiClient.get(`/api/product-update/requests/${sanitizedArgs.identifier}`);
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        identifier: sanitizedArgs.identifier,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



