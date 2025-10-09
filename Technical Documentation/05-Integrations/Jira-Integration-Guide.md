# Jira Integration Guide

## Overview

The Roadmap page currently uses mock data to demonstrate the functionality. To connect to real Jira data, follow these steps to configure the Atlassian MCP server.

## Prerequisites

1. **Jira Cloud Instance**: Access to a Jira Cloud instance
2. **API Token**: Atlassian API token for authentication
3. **Permissions**: View permissions for initiatives assigned to Kevin Yu

## Setup Instructions

### 1. Create Atlassian API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Enter a label (e.g., "Platform Roadmap App")
4. Copy the generated token securely

### 2. Configure MCP Authentication

The Atlassian MCP server requires authentication configuration. Add your credentials to the MCP configuration:

```json
{
  "auth": {
    "type": "api_token",
    "email": "your-email@company.com",
    "token": "your-api-token-here"
  },
  "cloudId": "your-jira-cloud-id"
}
```

### 3. Update Application Code

Replace the mock API endpoint in `app.js` with real Atlassian MCP calls:

```javascript
// Replace the existing /api/jira/initiatives endpoint with:
app.post('/api/jira/initiatives', async (req, res) => {
    try {
        // Use Atlassian MCP to search for initiatives
        const jqlQuery = 'assignee = "Kevin Yu" AND type = Initiative AND status IN ("Proposed", "Committed", "Open")';
        
        // Call Atlassian MCP searchJiraIssuesUsingJql function
        const result = await atlassianMcp.searchJiraIssuesUsingJql({
            cloudId: process.env.JIRA_CLOUD_ID,
            jql: jqlQuery,
            fields: ['key', 'summary', 'status', 'created', 'updated', 'description']
        });
        
        res.json({
            issues: result.issues,
            total: result.total
        });
        
    } catch (error) {
        console.error('Jira API error:', error);
        res.status(500).json({
            error: 'Failed to fetch Jira initiatives',
            message: error.message
        });
    }
});
```

### 4. Environment Variables

Set up environment variables for security:

```bash
export JIRA_CLOUD_ID="your-cloud-id"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"
```

### 5. Find Cloud ID

To find your Jira Cloud ID, you can:

1. Use the Atlassian MCP `getAccessibleAtlassianResources` function
2. Or extract from your Jira URL (e.g., `https://yoursite.atlassian.net`)

## JQL Query Customization

The current JQL query searches for:
- **Assignee**: Kevin Yu
- **Type**: Initiative
- **Status**: Proposed, Committed, or Open

To modify the search criteria, update the JQL query in both:
- Server-side: `app.js` API endpoint
- Client-side: `public/script.js` fetchJiraInitiatives function

### Example JQL Variations

```javascript
// All initiatives for Kevin Yu
'assignee = "Kevin Yu" AND type = Initiative'

// Include additional statuses
'assignee = "Kevin Yu" AND type = Initiative AND status IN ("Proposed", "Committed", "Open", "In Progress")'

// Filter by project
'assignee = "Kevin Yu" AND type = Initiative AND project = "PLAT"'

// Include epics as well
'assignee = "Kevin Yu" AND type IN ("Initiative", "Epic")'
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check API token and email
2. **403 Forbidden**: Verify Jira permissions
3. **Empty Results**: Verify JQL query and user assignment

### Test Authentication

Use the Atlassian MCP tools to test:

```javascript
// Test user info
await atlassianMcp.atlassianUserInfo();

// Test accessible resources
await atlassianMcp.getAccessibleAtlassianResources();

// Test simple search
await atlassianMcp.searchJiraIssuesUsingJql({
    cloudId: "your-cloud-id",
    jql: "assignee = currentUser()"
});
```

## Data Mapping

The application expects the following data structure:

```javascript
{
    key: "PLAT-001",
    summary: "Initiative Title",
    status: "Committed",
    created: "2025-01-10T09:00:00Z",
    updated: "2025-01-18T14:30:00Z",
    description: "Initiative description"
}
```

If your Jira fields differ, update the mapping in the API endpoint.

## Security Notes

- Store API tokens securely using environment variables
- Use HTTPS in production
- Implement proper error handling
- Consider rate limiting for API calls
- Rotate API tokens regularly

## Current Status

✅ **Working**: Mock data implementation with full UI functionality
🔄 **Pending**: Real Jira integration (requires authentication setup)
📋 **Next Steps**: Configure Atlassian MCP authentication

---

For questions or issues, check the [Atlassian MCP Documentation](https://developer.atlassian.com/) or contact your system administrator.

