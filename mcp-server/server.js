#!/usr/bin/env node

/**
 * DeployAssist MCP Server
 * 
 * Exposes DeployAssist application functionality through Model Context Protocol
 * 
 * Usage:
 *   node server.js
 * 
 * Configuration:
 *   See .env file and config/mcp-config.js
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Import configuration and utilities
const config = require('./config/mcp-config');
const toolRegistry = require('./config/tool-registry');
const ApiClient = require('./utils/api-client');
const ResponseFormatter = require('./utils/response-formatter');
const AuthHandler = require('./middleware/auth-handler');
const ErrorHandler = require('./middleware/error-handler');

// Initialize components
const apiClient = new ApiClient();
const authHandler = new AuthHandler(apiClient);
const errorHandler = new ErrorHandler();
const formatter = new ResponseFormatter();

// Create MCP server
const server = new Server(
  {
    name: config.serverName,
    version: config.serverVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handle tool list request
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = toolRegistry.getToolMetadata();
  
  console.error(`[MCP] Tools list requested: ${tools.length} tools available`);
  
  return {
    tools: tools,
  };
});

/**
 * Handle tool execution request
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[MCP] Tool call: ${name}`);
  console.error(`[MCP] Arguments:`, JSON.stringify(args, null, 2));
  
  try {
    // Get the tool
    const tool = toolRegistry.getTool(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // Get auth token from environment or context
    const token = authHandler.getTokenFromContext(args);
    
    if (!token) {
      const errorResponse = formatter.authError('No authentication token provided. Please set AUTH_TOKEN in environment or pass in request.');
      console.error(`[MCP] Auth error:`, errorResponse);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
    
    // Validate authentication
    try {
      await authHandler.validate(token);
      console.error(`[MCP] Authentication successful`);
    } catch (authError) {
      const errorResponse = errorHandler.handle(authError, name);
      console.error(`[MCP] Auth validation failed:`, errorResponse);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
      };
    }
    
    // Create execution context
    const context = {
      auth: authHandler,
      apiClient: apiClient,
      formatter: formatter,
      validator: require('./middleware/validation'),
    };
    
    // Execute tool
    const startTime = Date.now();
    const result = await tool.execute(args, context);
    const executionTime = Date.now() - startTime;
    
    console.error(`[MCP] Tool execution successful (${executionTime}ms)`);
    
    // Format response for MCP protocol
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
    
  } catch (error) {
    // Handle errors
    const errorResponse = errorHandler.handle(error, name);
    console.error(`[MCP] Tool execution failed:`, errorResponse);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function startServer() {
  console.error(`[MCP] Starting ${config.serverName} v${config.serverVersion}`);
  
  // Test API connection
  const connectionTest = await apiClient.testConnection();
  if (!connectionTest.connected) {
    console.error(`[MCP] ⚠️  Warning: Cannot connect to internal API at ${config.internalApi.url}`);
    console.error(`[MCP] Error: ${connectionTest.error}`);
    console.error(`[MCP] The server will start but tools may fail. Please ensure the main application is running.`);
  } else {
    console.error(`[MCP] ✅ Connected to internal API at ${config.internalApi.url}`);
  }
  
  // Log configuration
  console.error(`[MCP] Auth mode: ${config.auth.mode}`);
  console.error(`[MCP] Tools registered: ${toolRegistry.getTools().length}`);
  
  // List all tools
  const tools = toolRegistry.getTools();
  console.error(`[MCP] Available tools:`);
  tools.forEach(tool => {
    console.error(`[MCP]   - ${tool.name}: ${tool.description.substring(0, 80)}...`);
  });
  
  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`[MCP] ✅ Server started and listening on stdio`);
  console.error(`[MCP] Ready to receive requests from MCP clients`);
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.error(`[MCP] Received SIGINT, shutting down gracefully...`);
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error(`[MCP] Received SIGTERM, shutting down gracefully...`);
  await server.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('[MCP] Fatal error starting server:', error);
  process.exit(1);
});






