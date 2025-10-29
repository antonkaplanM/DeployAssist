const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * MCP Tool: Get expired products for a specific ghost account
 * 
 * Fetches and parses the expired products/entitlements from Salesforce
 * for a specific ghost account. Supports filtering by category and excluding
 * specific products by name.
 */
module.exports = {
  name: 'get_ghost_account_products',
  description: 'Get expired products/entitlements for a specific ghost account. Fetches product details from Salesforce with optional filtering by category (Model, Data, App) and ability to exclude products by name (e.g., exclude "CoD"). Useful for analyzing which specific products have expired for a ghost account.',
  
  inputSchema: {
    type: 'object',
    properties: {
      accountId: {
        type: 'string',
        description: 'Ghost account ID (account_id from ghost_accounts table)',
        minLength: 1,
        maxLength: 500,
      },
      category: {
        type: 'string',
        description: 'Filter by product category (optional)',
        enum: ['Model', 'Data', 'App'],
      },
      excludeProduct: {
        type: 'string',
        description: 'Exclude products containing this string (e.g., "CoD" to exclude CoD products)',
        maxLength: 255,
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
      
      // Sanitize inputs
      const sanitizedArgs = validator.sanitizeInputs(args);
      
      // Build query parameters
      const params = {};
      if (sanitizedArgs.category) {
        params.category = sanitizedArgs.category;
      }
      if (sanitizedArgs.excludeProduct) {
        params.excludeProduct = sanitizedArgs.excludeProduct;
      }
      
      // Call API
      const response = await context.apiClient.get(
        `/api/ghost-accounts/${encodeURIComponent(sanitizedArgs.accountId)}/products`,
        { params: params }
      );
      
      // Format response
      return formatter.success(response.data, {
        executionTime: response.duration,
        accountId: sanitizedArgs.accountId,
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};


