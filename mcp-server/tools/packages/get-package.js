const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Get Package Tool
 * Get detailed information about a specific package
 */
module.exports = {
  name: 'get_package',
  description: 'Get detailed information about a specific package by identifier. Shows complete package metadata, dependencies, versions, and usage information.',
  
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Package identifier (Salesforce ID or package name)',
        minLength: 1,
        maxLength: 255,
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
      const response = await context.apiClient.get(`/api/packages/${sanitizedArgs.identifier}`);
      
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


