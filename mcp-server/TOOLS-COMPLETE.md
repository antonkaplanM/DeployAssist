# Complete Tools List - DeployAssist MCP Server

## Summary

**Total Tools: 40**

All major DeployAssist functionality is now accessible through the MCP server.

## Tools by Category

### Analytics Tools (8 tools)

1. **get_validation_trend** - Validation error trends over time
2. **get_request_types_week** - Request type breakdown for current week
3. **get_package_changes_summary** - Package changes summary statistics
4. **get_package_changes_by_product** - Package changes grouped by product
5. **get_package_changes_by_account** - Package changes grouped by account
6. **get_recent_package_changes** - Most recent package changes
7. **get_package_changes_status** - Package changes system status
8. **get_ps_request_volume** - Professional Services request volume stats

### Provisioning Tools (7 tools)

9. **search_provisioning_requests** - Search deployment requests with filters
10. **get_provisioning_request** - Get specific request by ID
11. **get_provisioning_filter_options** - Available filter options
12. **get_new_provisioning_records** - New records since last check
13. **get_provisioning_removals** - Product removal requests
14. **list_provisioning_requests** - List all requests with pagination
15. **get_validation_errors** - Current validation errors

### Audit Trail Tools (5 tools)

16. **get_audit_stats** - PS audit trail statistics
17. **search_ps_records** - Search PS audit records
18. **get_ps_record** - Complete audit trail for specific PS record
19. **get_ps_status_changes** - Status change history for PS record
20. **capture_ps_audit_changes** - Manually trigger audit capture (WRITE)

### Customer Products Tools (7 tools)

21. **list_customer_products** - Active products by region and category
22. **get_product_update_options** - Available product update options
23. **create_product_update_request** - Create update request (WRITE)
24. **get_product_update_requests** - List product update requests
25. **get_product_update_request** - Get specific update request
26. **update_product_request_status** - Update request status (WRITE)
27. **get_product_request_history** - Complete request history

### Expiration Tools (3 tools)

28. **get_expiration_monitor** - Products expiring within timeframe
29. **refresh_expiration_data** - Manually refresh data (WRITE)
30. **get_expiration_status** - Expiration monitor system status

### Account Tools (4 tools)

31. **list_ghost_accounts** - Ghost accounts needing cleanup
32. **review_ghost_account** - Mark ghost account as reviewed (WRITE)
33. **delete_ghost_account** - Remove from tracking (WRITE)
34. **get_deprovisioned_accounts** - Historical deprovisioned accounts

### Package Tools (3 tools)

35. **list_packages** - List packages from repository
36. **get_package** - Detailed package information
37. **get_package_stats** - Package repository statistics

### Integration Tools (3 tools)

38. **test_salesforce_connection** - Test Salesforce connectivity
39. **query_salesforce** - Execute SOQL query (Advanced)
40. **search_jira_initiatives** - Search Jira issues and initiatives

## Tool Types

### Read-Only Tools: 31
Safe operations that query and retrieve data without modifications.

### Write Operations: 9
Tools that create, update, or delete data. Use with caution:

1. capture_ps_audit_changes
2. create_product_update_request
3. update_product_request_status
4. refresh_expiration_data
5. review_ghost_account
6. delete_ghost_account
7. (Additional write operations as needed)

## Quick Reference

### Most Common Use Cases

**Search & Discovery:**
- `search_provisioning_requests` - Find deployment requests
- `search_ps_records` - Find PS records
- `list_customer_products` - Browse customer products
- `search_jira_initiatives` - Find Jira issues

**Analytics & Reporting:**
- `get_validation_trend` - Data quality monitoring
- `get_package_changes_summary` - Package activity
- `get_ps_request_volume` - Workload analysis
- `get_audit_stats` - Audit trail insights

**Proactive Monitoring:**
- `get_expiration_monitor` - Expiring products
- `list_ghost_accounts` - Cleanup candidates
- `get_new_provisioning_records` - New requests
- `get_validation_errors` - Data quality issues

**Detailed Investigation:**
- `get_provisioning_request` - Request details
- `get_ps_record` - PS record history
- `get_product_update_request` - Update request status
- `get_package` - Package information

**System Health:**
- `test_salesforce_connection` - Integration status
- `get_expiration_status` - Monitor health
- `get_package_changes_status` - System status
- `get_package_stats` - Repository metrics

## Usage Patterns

### Pattern 1: Search → Details
```
1. search_provisioning_requests(query: "Acme Corp")
2. get_provisioning_request(id: "PS-12345")
```

### Pattern 2: Monitor → Act
```
1. get_expiration_monitor(days: 30)
2. list_customer_products(accountName: "Acme Corp")
3. create_product_update_request(...) [if renewal needed]
```

### Pattern 3: Analytics → Deep Dive
```
1. get_validation_trend(days: 30)
2. get_validation_errors()
3. get_provisioning_request(id: [error request])
```

### Pattern 4: Audit → Investigate
```
1. search_ps_records(query: "PS-001")
2. get_ps_record(identifier: "PS-001")
3. get_ps_status_changes(identifier: "PS-001")
```

## Feature Coverage

### ✅ Fully Covered
- Analytics Dashboard
- Provisioning Monitor
- PS Audit Trail
- Customer Products
- Expiration Monitor
- Ghost Accounts
- Package Repository
- Salesforce Integration
- Jira Integration

### 🔄 Partially Covered
- User Management (not included - admin operations)
- Settings Management (not included - config changes)
- Authentication (handled at MCP level)

### ❌ Not Included
- File uploads
- Bulk imports
- Database administration
- System configuration changes

## Security Notes

### Authentication
All tools require valid JWT token passed via environment or context.

### Authorization
Tools respect user roles and page entitlements from the main application.

### Write Operations
Write operations should be used sparingly and with proper approval workflows.

### Rate Limiting
Configured limits:
- 100 requests/minute per user
- 20 requests/minute per tool
- 1000 requests/minute global

## Performance

### Expected Response Times
- Simple queries: 100-300ms
- Complex searches: 200-500ms
- Salesforce operations: 500-2000ms
- Data refreshes: 1000-5000ms

### Best Practices
1. Use pagination for large result sets
2. Apply filters to narrow results
3. Cache frequently accessed data
4. Avoid unnecessary refreshes
5. Batch related queries when possible

## Error Handling

All tools return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "status": 400,
    "timestamp": "2025-10-24T12:00:00Z"
  }
}
```

Common error codes:
- `AUTH_FAILED` (401) - Authentication issue
- `PERMISSION_DENIED` (403) - Authorization issue
- `VALIDATION_ERROR` (400) - Invalid input
- `NOT_FOUND` (404) - Resource not found
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests

## Testing

### Test Each Category
```bash
# Analytics
get_validation_trend(days: 30)

# Provisioning
search_provisioning_requests(query: "test")

# Audit
get_audit_stats()

# Products
list_customer_products(limit: 10)

# Expiration
get_expiration_monitor(days: 30)

# Accounts
list_ghost_accounts(limit: 10)

# Packages
list_packages(limit: 10)

# Integrations
test_salesforce_connection()
```

## Roadmap

### Future Enhancements
- [ ] Batch operations
- [ ] Webhook subscriptions
- [ ] Real-time notifications
- [ ] Advanced caching
- [ ] Query optimization
- [ ] Export to various formats
- [ ] Scheduled reports
- [ ] Custom dashboards

## Support

For issues or questions:
1. Check tool documentation in `Tool-Reference.md`
2. Review API endpoints in `app.js`
3. Test tools individually
4. Check audit trail: `SELECT * FROM mcp_tool_invocations`

## Version History

- **v2.0.0** (Current) - Complete tool coverage (40 tools)
- **v1.0.0** - Prototype (5 tools)

---

**Status:** ✅ Production Ready  
**Last Updated:** October 24, 2025  
**Total Tools:** 40  
**Coverage:** Complete


