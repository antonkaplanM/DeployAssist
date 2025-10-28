const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Update Product Request Status Tool
 * Update status of a product update request (WRITE OPERATION)
 */
module.exports = {
  name: 'update_product_request_status',
  description: 'Update the status of a product update request. This is a WRITE operation for workflow management. Can approve, reject, complete, or cancel requests. Requires proper permissions.',
  
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Request identifier (ID or request number)',
        minLength: 1,
        maxLength: 100,
      },
      status: {
        type: 'string',
        description: 'New status for the request',
        enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      },
      notes: {
        type: 'string',
        description: 'Notes explaining the status change (optional but recommended)',
        maxLength: 2000,
      },
    },
    required: ['identifier', 'status'],
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Call API (PATCH request)
      const response = await context.apiClient.patch(`/api/product-update/requests/${sanitizedArgs.identifier}/status`, {
        status: sanitizedArgs.status,
        notes: sanitizedArgs.notes,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'status_updated',
        identifier: sanitizedArgs.identifier,
        newStatus: sanitizedArgs.status,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



