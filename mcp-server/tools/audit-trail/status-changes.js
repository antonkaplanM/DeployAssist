const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Status Changes Tool
 * Get status change history for a PS record
 */
module.exports = {
  name: 'get_ps_status_changes',
  description: 'Get status change history for a Professional Services record. Shows timeline of status transitions with timestamps and change details. Useful for tracking record lifecycle.',
  
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'PS record identifier (Salesforce ID or record name)',
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
      const response = await context.apiClient.get(`/api/audit-trail/status-changes/${sanitizedArgs.identifier}`);
      
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


