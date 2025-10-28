const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Review Ghost Account Tool
 * Mark a ghost account as reviewed (WRITE OPERATION)
 */
module.exports = {
  name: 'review_ghost_account',
  description: 'Mark a ghost account as reviewed with optional notes. This is a WRITE operation for tracking which accounts have been investigated. Helps prevent duplicate work.',
  
  inputSchema: {
    type: 'object',
    properties: {
      accountId: {
        type: 'string',
        description: 'Account ID or identifier',
        minLength: 1,
        maxLength: 100,
      },
      reviewNotes: {
        type: 'string',
        description: 'Notes about the review outcome (optional)',
        maxLength: 2000,
      },
      actionTaken: {
        type: 'string',
        description: 'Action taken (optional)',
        enum: ['contacted_customer', 'scheduled_renewal', 'marked_for_deprovisioning', 'no_action_needed', 'other'],
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
      
      // Call API (POST request)
      const response = await context.apiClient.post(`/api/ghost-accounts/${sanitizedArgs.accountId}/review`, {
        reviewNotes: sanitizedArgs.reviewNotes,
        actionTaken: sanitizedArgs.actionTaken,
      });
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        action: 'account_reviewed',
        accountId: sanitizedArgs.accountId,
      });
      
    } catch (error) {
      throw error;
    }
  },
};



