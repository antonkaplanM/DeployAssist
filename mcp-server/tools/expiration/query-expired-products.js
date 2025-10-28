const ResponseFormatter = require('../../utils/response-formatter');
const InputValidator = require('../../middleware/validation');

/**
 * Query Expired Products Tool
 * Get expired products with flexible filtering by category, product name, and account
 */
module.exports = {
  name: 'query_expired_products',
  description: 'Query expired products with flexible filtering. Filter by product category (Core, Apps, Add-on, etc.), exclude specific products (e.g., CoD), and optionally filter by account. Shows which specific products have expired for each account. Useful for analyzing expired products by category and planning renewals or deprovisioning.',
  
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by product type (optional)',
        enum: ['Model', 'Data', 'App'],
      },
      accountName: {
        type: 'string',
        description: 'Filter by specific account name (optional)',
        maxLength: 255,
      },
      productName: {
        type: 'string',
        description: 'Filter by product name (partial match, optional)',
        maxLength: 255,
      },
      excludeProduct: {
        type: 'string',
        description: 'Exclude products containing this string (e.g., "CoD" to exclude CoD products)',
        maxLength: 255,
      },
      includeGhostAccountsOnly: {
        type: 'boolean',
        description: 'Only include products from accounts in ghost_accounts table (default: false)',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100, max: 500)',
        default: 100,
        minimum: 1,
        maximum: 500,
      },
      groupByAccount: {
        type: 'boolean',
        description: 'Group results by account (default: true)',
        default: true,
      },
    },
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
      const params = {
        category: sanitizedArgs.category,
        accountName: sanitizedArgs.accountName,
        productName: sanitizedArgs.productName,
        excludeProduct: sanitizedArgs.excludeProduct,
        includeGhostAccountsOnly: sanitizedArgs.includeGhostAccountsOnly || false,
        limit: sanitizedArgs.limit || 100,
        groupByAccount: sanitizedArgs.groupByAccount !== false, // default true
      };
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      // Call API
      const response = await context.apiClient.get('/api/expiration/expired-products', {
        params: params,
      });
      
      // Format response
      const data = response.data;
      
      return formatter.success(data, {
        executionTime: response.duration,
        count: data.accounts ? data.accounts.length : (Array.isArray(data.products) ? data.products.length : 0),
        filters: params,
      });
      
    } catch (error) {
      throw error;
    }
  },
};

