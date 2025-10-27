const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Provisioning Request Tool
 * Get details of a single provisioning request by ID
 */
module.exports = {
  name: 'get_provisioning_request',
  description: 'Get detailed information about a specific provisioning request by its ID. Returns complete request details including status, account info, and history.',
  
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Request ID (e.g., PS-12345 or numeric ID)',
        minLength: 1,
        maxLength: 50,
      },
    },
    required: ['id'],
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Call API
      const response = await context.apiClient.get(`/api/provisioning/requests/${sanitizedArgs.id}`);
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        requestId: sanitizedArgs.id,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


