# MCP Tools Reference

Quick reference guide for all available MCP tools.

## Prototype Tools (v1.0.0)

### 1. get_validation_trend

**Category:** Analytics  
**Purpose:** Get validation error trends for Technical Team Requests over time

**Parameters:**
- `days` (number, optional) - Number of days to look back (default: 30, max: 90)

**Example Usage:**
```
Show me validation errors for the past 30 days
Get the validation trend for the last 60 days
What's the validation error pattern this month?
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "date": "2025-10-01",
        "errorCount": 23,
        "requestCount": 156
      }
    ]
  },
  "metadata": {
    "executionTime": 234,
    "days": 30
  }
}
```

---

### 2. search_provisioning_requests

**Category:** Provisioning  
**Purpose:** Search deployment/provisioning requests with flexible filters

**Parameters:**
- `query` (string, optional) - Search query for account name, request ID, or text
- `status` (string, optional) - Filter by status: `pending`, `completed`, `failed`, `in_progress`
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 50, max: 100)

**Example Usage:**
```
Search for provisioning requests for "Acme Corp"
Find all pending provisioning requests
Show me recent deployment requests
Get provisioning requests with status completed
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "PS-12345",
      "accountName": "Acme Corp",
      "status": "pending",
      "requestType": "New License",
      "createdAt": "2025-10-20T10:00:00Z"
    }
  ],
  "metadata": {
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 145,
      "hasMore": true
    }
  }
}
```

---

### 3. get_audit_stats

**Category:** Audit Trail  
**Purpose:** Get statistics about Professional Services audit trail

**Parameters:** None

**Example Usage:**
```
What are the audit trail statistics?
Show me PS audit stats
Get audit trail summary
How many PS records are being tracked?
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRecords": 1234,
    "statusChanges": 567,
    "averageChangesPerRecord": 2.3,
    "mostActiveRecords": [
      {
        "identifier": "PS-001",
        "changeCount": 15
      }
    ]
  },
  "metadata": {
    "executionTime": 123
  }
}
```

---

### 4. list_customer_products

**Category:** Customer Products  
**Purpose:** List all active products for customers by region and category

**Parameters:**
- `accountName` (string, optional) - Filter by specific account
- `region` (string, optional) - Filter by region: `NAM`, `EMEA`, `APAC`, `LATAM`
- `category` (string, optional) - Filter by category: `Core`, `Add-on`, `Professional Services`, `Support`
- `limit` (number, optional) - Max results (default: 100, max: 500)

**Example Usage:**
```
Show me all products for "Acme Corp"
List customer products in EMEA
Get all add-on products
What products does TechCo have?
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountName": "Acme Corp",
      "region": "NAM",
      "productName": "Platform Core",
      "category": "Core",
      "status": "Active",
      "expirationDate": "2026-12-31"
    }
  ],
  "metadata": {
    "executionTime": 345,
    "count": 12,
    "filters": {
      "accountName": "Acme Corp"
    }
  }
}
```

---

### 5. get_expiration_monitor

**Category:** Expiration  
**Purpose:** Get products/entitlements expiring within a timeframe

**Parameters:**
- `days` (number, optional) - Days to look ahead (default: 30, min: 7, max: 90)
- `region` (string, optional) - Filter by region: `NAM`, `EMEA`, `APAC`, `LATAM`
- `accountName` (string, optional) - Filter by account name
- `productName` (string, optional) - Filter by product name
- `sortBy` (string, optional) - Sort by: `expirationDate`, `accountName`, `productName`, `region`

**Example Usage:**
```
What products are expiring in the next 30 days?
Show me expiring products in NAM region
Get products expiring in the next 60 days
Which Acme Corp products are expiring soon?
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountName": "Acme Corp",
      "productName": "Platform Core",
      "expirationDate": "2025-11-15",
      "daysUntilExpiration": 22,
      "region": "NAM"
    }
  ],
  "metadata": {
    "executionTime": 287,
    "count": 8,
    "daysAhead": 30,
    "filters": {
      "days": 30
    }
  }
}
```

---

## Common Response Format

All tools return responses in this standard format:

### Success Response
```json
{
  "success": true,
  "data": { /* tool-specific data */ },
  "metadata": {
    "timestamp": "2025-10-24T12:00:00Z",
    "executionTime": 234,
    /* other tool-specific metadata */
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 400,
    "timestamp": "2025-10-24T12:00:00Z"
  }
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_FAILED` | 401 | Authentication failed or token invalid |
| `PERMISSION_DENIED` | 403 | User lacks permission for this operation |
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `UNKNOWN_ERROR` | 500 | Internal server error |

## Best Practices

### 1. Natural Language Queries

Claude can interpret natural language and map it to appropriate tool calls:

✅ **Good:**
- "Show me products expiring soon"
- "Search for Acme Corp provisioning requests"
- "What are the validation trends this month?"

❌ **Avoid:**
- Technical jargon unless necessary
- Overly complex multi-part queries
- Requesting operations not yet implemented

### 2. Pagination

For tools that return lists, use pagination for large results:

```
Show me the first 10 provisioning requests
Get the next page of results
Show me 20 customer products
```

### 3. Filtering

Use filters to narrow down results:

```
Show me pending provisioning requests in NAM region
Get validation errors for the past 7 days only
List products for Acme Corp in the Core category
```

### 4. Combining Context

Claude can combine information from multiple tool calls:

```
Show me products expiring in 30 days and search for 
related provisioning requests for those accounts
```

## Tool Categories

### Analytics Tools (1)
- `get_validation_trend` - Validation error trends

### Provisioning Tools (1)
- `search_provisioning_requests` - Search deployment requests

### Audit Trail Tools (1)
- `get_audit_stats` - PS audit statistics

### Customer Products Tools (1)
- `list_customer_products` - Active customer products

### Expiration Tools (1)
- `get_expiration_monitor` - Expiring entitlements

## Future Tools (Coming Soon)

### Analytics (7 more tools)
- `get_request_types_week` - Request types this week
- `get_package_changes_summary` - Package change analytics
- `get_package_changes_by_product` - Changes by product
- `get_package_changes_by_account` - Changes by account
- `get_recent_package_changes` - Recent package changes
- `export_package_changes` - Export package data
- `refresh_package_changes` - Refresh package cache

### Provisioning (6 more tools)
- `get_provisioning_request` - Get single request details
- `get_filter_options` - Available filter options
- `get_new_provisioning_records` - New records
- `get_provisioning_removals` - Product removals
- `list_provisioning_requests` - Full list
- `get_provisioning_request_detail` - Detailed view

### Audit Trail (4 more tools)
- `search_ps_records` - Search PS records
- `get_status_changes` - Status change history
- `get_ps_record` - Single PS record
- `capture_audit_changes` - Trigger audit capture

### Customer Products (4 more tools)
- `get_product_update_options` - Available product options
- `create_product_update_request` - Create update request
- `get_product_update_requests` - List update requests
- `update_product_request_status` - Update request status

### Integrations (6+ tools)
- `query_salesforce` - Query Salesforce data
- `test_salesforce_connection` - Test SF connection
- `search_jira_initiatives` - Search Jira issues
- `get_packages` - Get package information
- `get_package_detail` - Package details
- And more...

## Performance

### Expected Response Times

| Tool | Avg Time | Max Time |
|------|----------|----------|
| `get_validation_trend` | 200-300ms | 500ms |
| `search_provisioning_requests` | 100-400ms | 800ms |
| `get_audit_stats` | 100-200ms | 400ms |
| `list_customer_products` | 200-500ms | 1000ms |
| `get_expiration_monitor` | 200-400ms | 800ms |

### Rate Limits

- **Per User:** 100 requests/minute
- **Per Tool:** 20 requests/minute
- **Global:** 1000 requests/minute

*Note: Rate limiting is configured but not yet enforced in prototype*

## Troubleshooting

### Tool Returns Empty Results

**Possible Causes:**
1. No data matches your filters
2. User lacks permission to view the data
3. Database has no data in that category

**Solutions:**
- Try broader search criteria
- Check user permissions in the application
- Verify data exists in the application UI

### Authentication Errors

**Error:** "Authentication failed"

**Solutions:**
- Get fresh JWT token from browser cookies
- Tokens expire after 24 hours
- Update `AUTH_TOKEN` in Claude Desktop config
- Restart Claude Desktop

### Slow Response Times

**Possible Causes:**
1. Large dataset being queried
2. Main application is slow
3. Database query performance

**Solutions:**
- Use pagination and filters
- Check main application performance
- Monitor database query performance

---

**Last Updated:** October 24, 2025  
**Version:** 1.0.0 (Prototype)  
**Tool Count:** 5 core tools






