# MCP Server Implementation Plan

## Overview

This document outlines the implementation plan for exposing DeployAssist application functionality through a Model Context Protocol (MCP) server, enabling AI agents to programmatically access all application features.

## Architecture

### High-Level Design

```
AI Agent (Claude, etc.)
    ↓
MCP Protocol
    ↓
MCP Server (Node.js)
    ├── Tool Registry
    ├── Authentication Handler
    ├── API Client (calls existing API)
    └── Response Formatter
        ↓
    DeployAssist API (app.js)
        ↓
    Database & Integrations
```

## Folder Structure

```
mcp-server/
├── server.js                 # Main MCP server entry point
├── config/
│   ├── mcp-config.js        # MCP server configuration
│   └── tool-registry.js     # Central tool registration
├── tools/
│   ├── analytics/           # Analytics-related tools
│   │   ├── validation-trend.js
│   │   ├── request-types.js
│   │   └── package-changes.js
│   ├── provisioning/        # Provisioning tools
│   │   ├── search-requests.js
│   │   ├── get-request.js
│   │   └── filter-options.js
│   ├── audit-trail/         # PS Audit tools
│   │   ├── search-records.js
│   │   ├── status-changes.js
│   │   └── stats.js
│   ├── customer-products/   # Customer product tools
│   │   └── list-products.js
│   └── expiration/          # Expiration monitoring
│       └── monitor.js
├── middleware/
│   ├── auth-handler.js      # Authentication for MCP tools
│   ├── validation.js        # Input validation
│   └── error-handler.js     # Error formatting
└── utils/
    ├── api-client.js        # Client to call existing API
    └── response-formatter.js
```

## Tool Inventory

### Phase 1: Prototype (5 Core Tools)

| Tool Name | Category | Purpose | API Endpoint |
|-----------|----------|---------|--------------|
| `get_validation_trend` | Analytics | Retrieve validation error trends | `GET /api/analytics/validation-trend` |
| `search_provisioning_requests` | Provisioning | Search deployment requests | `GET /api/provisioning/search` |
| `get_audit_stats` | Audit Trail | Get PS audit statistics | `GET /api/audit-trail/stats` |
| `list_customer_products` | Customer Products | List active customer products | `GET /api/customer-products` |
| `get_expiration_monitor` | Expiration | Get expiring entitlements | `GET /api/expiration/monitor` |

### Future Tools (50+ total)

#### Analytics Tools (8 tools)
- `get_validation_trend`
- `get_request_types_week`
- `get_package_changes_summary`
- `get_package_changes_by_product`
- `get_package_changes_by_account`
- `get_recent_package_changes`
- `export_package_changes`
- `refresh_package_changes`

#### Provisioning Tools (7 tools)
- `search_provisioning_requests`
- `get_provisioning_request`
- `get_filter_options`
- `get_new_provisioning_records`
- `get_provisioning_removals`
- `list_provisioning_requests`
- `get_provisioning_request_detail`

#### Audit Trail Tools (5 tools)
- `search_ps_records`
- `get_status_changes`
- `get_audit_stats`
- `get_ps_record`
- `capture_audit_changes`

#### Customer Products Tools (5 tools)
- `list_customer_products`
- `get_product_update_options`
- `create_product_update_request`
- `get_product_update_requests`
- `update_product_request_status`

#### Expiration Tools (3 tools)
- `get_expiration_monitor`
- `refresh_expiration_data`
- `get_expiration_status`

#### Account Tools (4 tools)
- `get_account_history` (future - not in current API)
- `list_ghost_accounts`
- `review_ghost_account`
- `delete_ghost_account`

#### Integration Tools (6 tools)
- `query_salesforce`
- `test_salesforce_connection`
- `search_jira_initiatives`
- `query_sml` (future - SML routes exist)
- `get_packages`
- `get_package_detail`

#### Validation Tools (3 tools)
- `get_validation_errors`
- `get_validation_rules` (future)
- `update_validation_rules` (future)

## Authentication Strategy

### Recommended: Pass-through Authentication

**Flow:**
1. AI agent receives user's JWT token from application
2. Agent includes token in MCP tool invocation
3. MCP server validates token with auth service
4. Tool execution uses validated user context
5. API calls include user's token
6. Respects user's permissions and page entitlements

**Implementation:**
```javascript
// Tool invocation includes auth context
{
  "name": "search_provisioning_requests",
  "arguments": {
    "query": "account-123",
    "status": "pending"
  },
  "_meta": {
    "auth_token": "jwt_token_here"
  }
}
```

**Benefits:**
- ✅ Respects existing RBAC
- ✅ Audit trail shows actual user
- ✅ No elevated privilege risk
- ✅ Works with page entitlements

**Challenges:**
- ⚠️ Agent needs token management
- ⚠️ Token expiration handling
- ⚠️ Setup complexity

### Alternative: Service Account

**Flow:**
1. MCP server authenticates as dedicated service account
2. All operations run with service account privileges
3. Log actual user in MCP audit table

**Benefits:**
- ✅ Simpler agent setup
- ✅ No token management needed

**Challenges:**
- ⚠️ Security risk (elevated privileges)
- ⚠️ Audit trail loses user context
- ⚠️ Bypasses page entitlements

### Decision: Use Pass-through for Prototype

For the prototype, we'll implement pass-through authentication to maintain security best practices.

## Tool Design Pattern

### Standard Tool Structure

```javascript
module.exports = {
  name: 'tool_name',
  description: 'Clear description of what this tool does',
  
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      },
      param2: {
        type: 'number',
        description: 'Parameter description',
        default: 10
      }
    },
    required: ['param1']
  },
  
  async execute(args, context) {
    // 1. Validate authentication
    await context.auth.validate();
    
    // 2. Check permissions (if needed)
    await context.auth.checkPageAccess('page_name');
    
    // 3. Validate inputs
    context.validator.validate(args, this.inputSchema);
    
    // 4. Call API
    const response = await context.apiClient.get('/api/endpoint', {
      params: args,
      headers: {
        'Authorization': `Bearer ${context.auth.token}`
      }
    });
    
    // 5. Format response
    return context.formatter.success(response.data);
  },
  
  // Optional: Error handling
  handleError(error, context) {
    return context.formatter.error(error);
  }
};
```

## Security Requirements

### Critical Security Measures

1. **Authentication**
   - Every tool call must validate JWT token
   - Token expiration must be checked
   - Invalid tokens result in immediate rejection

2. **Authorization**
   - Respect existing role-based access control
   - Check page entitlements for each tool
   - Log unauthorized access attempts

3. **Rate Limiting**
   - Per-user limits: 100 requests/minute
   - Per-tool limits: 20 requests/minute
   - Global limit: 1000 requests/minute

4. **Audit Logging**
   - Log every tool invocation
   - Include: user, tool name, arguments, success/failure
   - Store in new `mcp_tool_invocations` table

5. **Input Validation**
   - Validate all inputs against schema
   - Sanitize strings (especially for SQL/JQL)
   - Reject malformed requests

6. **Secrets Protection**
   - Never expose API keys in responses
   - Redact sensitive fields
   - Don't log sensitive parameters

### New Database Table

```sql
CREATE TABLE mcp_tool_invocations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tool_name VARCHAR(255) NOT NULL,
  arguments JSONB,
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_tool_created (tool_name, created_at)
);
```

## Configuration

### Environment Variables

Add to `.env`:
```bash
# MCP Server Configuration
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3001
MCP_SERVER_NAME=deployassist-mcp
MCP_SERVER_VERSION=1.0.0

# MCP Authentication
MCP_AUTH_MODE=passthrough  # or 'service_account'
MCP_SERVICE_ACCOUNT_TOKEN=  # if using service account mode

# MCP Security
MCP_RATE_LIMIT_PER_USER=100  # requests per minute
MCP_RATE_LIMIT_PER_TOOL=20   # requests per minute
MCP_RATE_LIMIT_GLOBAL=1000   # requests per minute

# MCP Logging
MCP_AUDIT_LOGGING=true
MCP_LOG_LEVEL=info  # debug, info, warn, error

# Internal API Connection
INTERNAL_API_URL=http://localhost:5000
INTERNAL_API_TIMEOUT=30000  # 30 seconds
```

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [x] Create folder structure
- [ ] Set up MCP server with SDK
- [ ] Implement auth handler
- [ ] Build API client
- [ ] Create response formatter

### Phase 2: Prototype Tools (Days 3-4)
- [ ] Implement 5 core tools (read-only)
- [ ] Test each tool independently
- [ ] Validate authentication flow
- [ ] Test error handling

### Phase 3: Documentation (Day 5)
- [ ] Create setup guide
- [ ] Document each tool
- [ ] Add usage examples
- [ ] Create troubleshooting guide

### Phase 4: Testing & Refinement (Days 6-7)
- [ ] Integration testing
- [ ] Security testing
- [ ] Performance testing
- [ ] Bug fixes

### Phase 5: Expansion (Future)
- [ ] Add remaining read-only tools
- [ ] Implement write operations (with extra caution)
- [ ] Add batch operations
- [ ] Implement caching

## Usage Example

### Agent Configuration

Add to Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "deployassist": {
      "command": "node",
      "args": ["C:/path/to/hello-world-nodejs/mcp-server/server.js"],
      "env": {
        "NODE_ENV": "production",
        "AUTH_TOKEN": "user_jwt_token_here"
      }
    }
  }
}
```

### Tool Invocation

```javascript
// Agent invokes tool
const result = await invokeTool('search_provisioning_requests', {
  query: 'account-12345',
  status: 'pending',
  limit: 10
});

// Returns:
{
  success: true,
  data: {
    requests: [
      {
        id: '001',
        accountName: 'Acme Corp',
        status: 'pending',
        createdAt: '2025-10-20T10:00:00Z'
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 45,
      hasMore: true
    }
  },
  metadata: {
    executionTime: 234,
    cached: false
  }
}
```

## Monitoring & Observability

### Metrics to Track

1. **Usage Metrics**
   - Tool invocation count by tool
   - Tool invocation count by user
   - Success vs failure rates
   - Average execution time

2. **Performance Metrics**
   - Response time percentiles (p50, p95, p99)
   - API call duration
   - Error rates by type

3. **Security Metrics**
   - Authentication failures
   - Authorization failures
   - Rate limit hits
   - Suspicious patterns

### Logging

```javascript
// Every tool invocation logs:
{
  timestamp: '2025-10-24T12:00:00Z',
  level: 'info',
  type: 'tool_invocation',
  tool: 'search_provisioning_requests',
  user_id: 123,
  username: 'john.doe@example.com',
  arguments: { query: 'account-123', status: 'pending' },
  success: true,
  execution_time_ms: 234,
  api_calls: 1
}
```

## Success Criteria

### Prototype Success
- ✅ 5 tools implemented and working
- ✅ Authentication working correctly
- ✅ Tools respect user permissions
- ✅ Error handling is comprehensive
- ✅ Documentation is complete
- ✅ Can be invoked from Claude Desktop

### Production Ready
- ✅ All 50+ tools implemented
- ✅ Comprehensive test coverage
- ✅ Performance meets SLAs (<500ms p95)
- ✅ Security audit passed
- ✅ Monitoring and alerting set up
- ✅ Rate limiting working correctly
- ✅ Audit logging enabled

## Risk Mitigation

### Potential Risks

1. **Security Risk: Unauthorized Access**
   - Mitigation: Strong authentication, audit logging, rate limiting

2. **Performance Risk: Slow Response Times**
   - Mitigation: Caching, connection pooling, query optimization

3. **Reliability Risk: API Changes Break Tools**
   - Mitigation: Version API, automated tests, graceful degradation

4. **Compliance Risk: Data Exposure**
   - Mitigation: Field filtering, PII redaction, access controls

5. **Operational Risk: High Load**
   - Mitigation: Rate limiting, auto-scaling, circuit breakers

## Next Steps

1. ✅ Review and approve this plan
2. Create prototype implementation
3. Test with Claude Desktop
4. Security review
5. Expand tool coverage
6. Deploy to production

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK for Node.js](https://github.com/modelcontextprotocol/sdk)
- DeployAssist API Documentation: See `app.js` endpoints
- Authentication System: See `Technical Documentation/09-Authentication/`





