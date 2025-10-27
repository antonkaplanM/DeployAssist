const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Delete Ghost Account Tool
 * Remove a ghost account from tracking (WRITE OPERATION)
 */
module.exports = {
  name: 'delete_ghost_account',
  description: 'Remove a ghost account from tracking. This is a WRITE operation (DESTRUCTIVE). Use when an account has been addressed and no longer needs monitoring. This does not deprovision the actual account.',
  
  inputSchema: {
    type: 'object',
    properties: {
      accountId: {
        type: 'string',
        description: 'Account ID or identifier',
        minLength: 1,
        maxLength: 100,
      },
      reason: {
        type: 'string',
        description: 'Reason for removal (optional but recommended)',
        maxLength: 500,
      },
    },
    required: ['accountId'],
  },
  
  async execute(args, context) {
    const formatter = new ResponseFormatter();
    const validator = new InputValidator();
    
    try {
      // Validate inputs
      validator.validate(args, this.inputSchema);
      
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Call API (DELETE request)
      const response = await context.apiClient.delete(`/api/ghost-accounts/${sanitizedArgs.accountId}`, {
        data: {
          reason: sanitizedArgs.reason,
        },
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'account_deleted',
        accountId: sanitizedArgs.accountId,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


