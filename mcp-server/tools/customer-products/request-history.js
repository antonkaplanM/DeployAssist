const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Product Request History Tool
 * Get complete history of a product update request
 */
module.exports = {
  name: 'get_product_request_history',
  description: 'Get complete change history for a product update request. Shows timeline of status changes, modifications, and approvals with timestamps and user details.',
  
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
      const response = await context.apiClient.get(`/api/product-update/requests/${sanitizedArgs.identifier}/history`);
      
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



