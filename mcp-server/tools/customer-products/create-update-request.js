const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Create Product Update Request Tool
 * Create a new product update request (WRITE OPERATION)
 */
module.exports = {
  name: 'create_product_update_request',
  description: 'Create a new product update request for a customer account. This is a WRITE operation that creates a formal request for product changes. Requires account name, product details, and action type.',
  
  inputSchema: {
    type: 'object',
    properties: {
      accountName: {
        type: 'string',
        description: 'Customer account name',
        minLength: 1,
        maxLength: 255,
      },
      productName: {
        type: 'string',
        description: 'Product name',
        minLength: 1,
        maxLength: 255,
      },
      actionType: {
        type: 'string',
        description: 'Type of action (add, remove, modify)',
        enum: ['add', 'remove', 'modify', 'upgrade', 'downgrade'],
      },
      requestedBy: {
        type: 'string',
        description: 'Name of person making the request',
        maxLength: 255,
      },
      notes: {
        type: 'string',
        description: 'Additional notes or justification (optional)',
        maxLength: 2000,
      },
      priority: {
        type: 'string',
        description: 'Request priority (optional)',
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
      },
    },
    required: ['accountName', 'productName', 'actionType', 'requestedBy'],
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Call API (POST request)
      const response = await context.apiClient.post('/api/product-update/requests', {
        accountName: sanitizedArgs.accountName,
        productName: sanitizedArgs.productName,
        actionType: sanitizedArgs.actionType,
        requestedBy: sanitizedArgs.requestedBy,
        notes: sanitizedArgs.notes,
        priority: sanitizedArgs.priority || 'normal',
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'request_created',
      });
      
    } catch (error) {
      throw error;
    }
  },
};


