# MCP Server Quick Start Guide

## What is the MCP Server?

The DeployAssist MCP (Model Context Protocol) Server exposes application functionality as tools that AI agents like Claude can invoke programmatically. This enables AI assistants to search data, retrieve analytics, and interact with your DeployAssist application on your behalf.

## Prerequisites

- DeployAssist application running (backend on port 5000)
- Node.js 16+ installed
- Valid JWT token from the application
- Claude Desktop (or compatible MCP client)

## Quick Setup

### 1. Install Dependencies

The MCP server dependencies are included in the main project:

```bash
cd hello-world-nodejs
npm install
```

### 2. Configure Environment

Add to your `.env` file:

```bash
# MCP Server Configuration
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3001
MCP_SERVER_NAME=deployassist-mcp
MCP_SERVER_VERSION=1.0.0

# Internal API Connection
INTERNAL_API_URL=http://localhost:5000
INTERNAL_API_TIMEOUT=30000
```

### 3. Start the MCP Server

```bash
# Terminal 1: Start main application
npm start

# Terminal 2: Start MCP server
node mcp-server/server.js
```

You should see:
```
✅ MCP Server 'deployassist-mcp' listening on stdio
✅ Connected to internal API at http://localhost:5000
✅ 5 tools registered
```

### 4. Configure Claude Desktop

Edit your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add:
```json
{
  "mcpServers": {
    "deployassist": {
      "command": "node",
      "args": ["C:/Users/kaplana/source/repos/hello-world-nodejs/mcp-server/server.js"],
      "env": {
        "NODE_ENV": "production",
        "AUTH_TOKEN": "your_jwt_token_here"
      }
    }
  }
}
```

**Getting your JWT token:**
1. Log in to DeployAssist (http://localhost:8080)
2. Open browser DevTools → Application → Cookies
3. Copy the `token` cookie value
4. Paste it as `AUTH_TOKEN` in the config above

### 5. Restart Claude Desktop

Close and reopen Claude Desktop completely.

### 6. Test the Tools

In Claude Desktop, try:

```
Can you search for provisioning requests for account "Acme Corp"?
```

Claude should use the `search_provisioning_requests` tool and return results from your DeployAssist application.

## Available Tools (Prototype)

### 1. `get_validation_trend`
Get validation error trends over time.

**Example:**
```
Show me the validation error trend for the past 30 days
```

### 2. `search_provisioning_requests`
Search deployment provisioning requests.

**Example:**
```
Find all pending provisioning requests for account "Acme Corp"
```

### 3. `get_audit_stats`
Get PS audit trail statistics.

**Example:**
```
What are the audit trail statistics?
```

### 4. `list_customer_products`
List active customer products.

**Example:**
```
Show me all active products for customer "Acme Corp"
```

### 5. `get_expiration_monitor`
Get products expiring soon.

**Example:**
```
What products are expiring in the next 30 days?
```

## Troubleshooting

### Tool Not Found

**Symptom:** Claude says "I don't have access to that tool"

**Solutions:**
1. Restart Claude Desktop completely
2. Check MCP server logs for errors
3. Verify config file path is correct
4. Ensure MCP server is running

### Authentication Failed

**Symptom:** "Authentication failed" or "Invalid token"

**Solutions:**
1. Get a fresh JWT token from browser
2. Token expires after 24 hours - refresh it
3. Ensure token is in `AUTH_TOKEN` env var
4. Check auth-handler.js logs

### Connection Refused

**Symptom:** "ECONNREFUSED" or "Cannot connect to API"

**Solutions:**
1. Ensure main application is running on port 5000
2. Check `INTERNAL_API_URL` in .env
3. Test API directly: `curl http://localhost:5000/health`

### No Results Returned

**Symptom:** Tools work but return empty results

**Solutions:**
1. Check if user has permission to access the page
2. Verify database has data
3. Test API endpoint directly in browser
4. Check audit logs in `mcp_tool_invocations` table

## Testing Without Claude Desktop

You can test the MCP server directly:

```bash
# Start the server
node mcp-server/server.js

# In another terminal, send a test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/server.js
```

## Development Mode

For development with auto-restart:

```bash
npm install -g nodemon

# Watch and restart on changes
nodemon mcp-server/server.js
```

## Logging

Logs are written to:
- Console (stdout)
- `logs/mcp-server.log` (if configured)
- Database: `mcp_tool_invocations` table

View recent invocations:
```sql
SELECT 
  tool_name,
  username,
  success,
  execution_time_ms,
  created_at
FROM mcp_tool_invocations
ORDER BY created_at DESC
LIMIT 20;
```

## Security Best Practices

1. **Never commit tokens**: Keep JWT tokens out of git
2. **Rotate tokens**: Update tokens regularly (every 24h)
3. **Monitor usage**: Check audit logs for suspicious activity
4. **Rate limits**: Respect rate limits (100 req/min per user)
5. **Least privilege**: Only grant necessary permissions

## Next Steps

Once the prototype is working:

1. ✅ Test all 5 prototype tools
2. Review audit logs to verify security
3. Request additional tools as needed
4. Report issues or suggestions

## Support

For issues or questions:
1. Check logs: `logs/mcp-server.log`
2. Review audit trail: `mcp_tool_invocations` table
3. See full documentation: `MCP-Server-Implementation-Plan.md`
4. Test API endpoints directly

## Example Session

```
You: Hi! Can you help me find provisioning requests?

Claude: I can help you search provisioning requests. What account 
        or criteria would you like to search for?

You: Show me all pending requests

Claude: [Uses search_provisioning_requests tool]
        I found 12 pending provisioning requests:
        
        1. Account: Acme Corp - Request ID: PS-12345 - Created: Oct 20
        2. Account: TechCo Inc - Request ID: PS-12346 - Created: Oct 21
        ...

You: Can you show me the validation trends?

Claude: [Uses get_validation_trend tool]
        Here's the validation error trend for the past 30 days:
        
        - Oct 1-7: 23 validation errors
        - Oct 8-14: 18 validation errors
        - Oct 15-21: 31 validation errors
        ...
```

That's it! You're now ready to use AI-assisted access to DeployAssist.





