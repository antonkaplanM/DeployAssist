const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get PS Record Tool
 * Get complete audit trail for a specific PS record
 */
module.exports = {
  name: 'get_ps_record',
  description: 'Get complete audit trail for a specific Professional Services record by identifier. Shows all historical changes, status transitions, and modifications.',
  
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
      const response = await context.apiClient.get(`/api/audit-trail/ps-record/${sanitizedArgs.identifier}`);
      
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



