# MCP Integration Documentation

This folder contains documentation for the DeployAssist Model Context Protocol (MCP) Server implementation.

## Overview

The MCP Server exposes DeployAssist application functionality as tools that AI agents like Claude can invoke programmatically. This enables AI-assisted workflows for searching data, analyzing trends, and managing customer information.

## Documentation Files

### 📋 [MCP-Server-Implementation-Plan.md](./MCP-Server-Implementation-Plan.md)
**Comprehensive implementation plan covering:**
- Architecture and design decisions
- Complete tool inventory (5 prototype + 50+ future tools)
- Authentication strategies
- Security requirements
- Database schema for audit logging
- Configuration options
- Implementation phases
- Risk mitigation

**Read this first** for a complete understanding of the MCP server design.

### 🚀 [Quick-Start-Guide.md](./Quick-Start-Guide.md)
**Step-by-step setup guide for:**
- Installing dependencies
- Configuring environment
- Starting the MCP server
- Connecting to Claude Desktop
- Testing the 5 prototype tools
- Troubleshooting common issues

**Read this to get up and running quickly.**

## Quick Reference

### What is MCP?

Model Context Protocol (MCP) is an open standard that enables AI models to securely interact with external systems through a standardized tool interface. Think of it as an API specifically designed for AI agents.

### What Can the MCP Server Do?

The prototype includes 5 core tools:

1. **get_validation_trend** - Analytics on validation errors over time
2. **search_provisioning_requests** - Search deployment requests with filters
3. **get_audit_stats** - PS audit trail statistics
4. **list_customer_products** - Active customer products by region
5. **get_expiration_monitor** - Products expiring within a timeframe

Future expansion will add 50+ additional tools covering all application features.

### Architecture

```
AI Agent (Claude)
    ↓
MCP Protocol (stdio)
    ↓
MCP Server (Node.js)
    ├── Authentication
    ├── Tool Registry
    └── API Client
        ↓
    DeployAssist API (app.js)
        ↓
    Database & Integrations
```

### Security

- ✅ **Authentication Required:** Every tool call validates JWT token
- ✅ **Permission-Based:** Respects user roles and page entitlements
- ✅ **Audit Logging:** All invocations can be logged (coming soon)
- ✅ **Input Validation:** All inputs sanitized and validated
- ✅ **Rate Limiting:** Configurable limits per user/tool (coming soon)

### File Locations

```
hello-world-nodejs/
├── mcp-server/                          # MCP server implementation
│   ├── server.js                        # Main entry point
│   ├── config/                          # Configuration
│   ├── tools/                           # Tool implementations
│   ├── middleware/                      # Auth, validation, errors
│   └── utils/                           # API client, formatters
│
└── Technical Documentation/
    └── 11-MCP-Integration/              # Documentation (you are here)
        ├── README.md                    # This file
        ├── MCP-Server-Implementation-Plan.md
        └── Quick-Start-Guide.md
```

## Getting Started

### Prerequisites

- DeployAssist application running on port 5000
- Node.js 16+ installed
- Valid JWT token from the application
- Claude Desktop (or compatible MCP client)

### Installation

```bash
# 1. Install dependencies
cd mcp-server
npm install

# 2. Start main application (in another terminal)
cd ..
npm start

# 3. Start MCP server
node mcp-server/server.js
```

### Configuration

Add to `.env` file:

```bash
MCP_SERVER_ENABLED=true
MCP_SERVER_NAME=deployassist-mcp
INTERNAL_API_URL=http://localhost:5000
```

Configure Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "deployassist": {
      "command": "node",
      "args": ["C:/path/to/hello-world-nodejs/mcp-server/server.js"],
      "env": {
        "AUTH_TOKEN": "your_jwt_token_here"
      }
    }
  }
}
```

### Testing

In Claude Desktop:

```
Can you search for provisioning requests for account "Acme Corp"?
```

Claude will use the `search_provisioning_requests` tool and return results.

## Current Status

### ✅ Completed (Prototype)

- [x] Server architecture and foundation
- [x] Authentication handler (pass-through mode)
- [x] API client for internal API calls
- [x] Response formatter
- [x] Error handling
- [x] Input validation
- [x] 5 core tools implemented
- [x] Tool registry
- [x] Documentation

### 🔄 In Progress

- [ ] Testing with Claude Desktop
- [ ] Security review
- [ ] Performance optimization

### 📋 Future Enhancements

- [ ] Database audit logging table
- [ ] Rate limiting enforcement
- [ ] Additional 45+ tools
- [ ] Write operations (with safeguards)
- [ ] Caching layer
- [ ] Batch operations
- [ ] Webhook support
- [ ] Real-time streaming

## Development

### Adding a New Tool

1. Create tool file in `mcp-server/tools/category/`
2. Implement tool with schema and execute method
3. Register in `mcp-server/config/tool-registry.js`
4. Test with Claude Desktop
5. Document in this folder

See the implementation plan for detailed tool structure patterns.

### Tool Categories

Tools are organized by functional domain:

- **analytics/** - Analytics and reporting tools
- **provisioning/** - Provisioning request tools
- **audit-trail/** - PS audit trail tools
- **customer-products/** - Customer product management
- **expiration/** - Expiration monitoring tools

Future categories: integrations, validation, accounts, packages, etc.

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot connect to API" | Ensure main app is running on port 5000 |
| "Authentication failed" | Get fresh JWT token from browser cookies |
| "Tool not found" | Restart Claude Desktop completely |
| No results | Check user permissions for the page |

### Debug Mode

Enable detailed logging:

```bash
export MCP_LOG_LEVEL=debug
node mcp-server/server.js
```

### Log Locations

- **MCP Server:** stderr output (terminal where server is running)
- **Main Application:** `logs/app.log`
- **Future:** `mcp_tool_invocations` database table

## Resources

### External Links

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/mcp)

### Internal Resources

- API Endpoints: See `app.js` routes
- Authentication System: `Technical Documentation/09-Authentication/`
- Database Schema: `database/init-scripts/`
- Testing: `tests/README.md`

## Contributing

When adding new tools:

1. Follow existing tool structure patterns
2. Include comprehensive input validation
3. Add descriptive schemas for AI agents
4. Test with real data
5. Update documentation
6. Consider security implications

## Questions?

For implementation questions, see:
- `MCP-Server-Implementation-Plan.md` for design decisions
- `Quick-Start-Guide.md` for setup help
- `mcp-server/README.md` for developer guide

## Version History

- **v1.0.0** (Current) - Prototype with 5 core tools
- **v1.1.0** (Planned) - 15 tools + audit logging
- **v2.0.0** (Future) - Complete tool coverage (50+ tools)

---

**Status:** ✅ Prototype Complete - Ready for Testing  
**Last Updated:** October 24, 2025





