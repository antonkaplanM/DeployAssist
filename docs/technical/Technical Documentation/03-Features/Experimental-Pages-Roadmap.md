# Experimental Pages - Roadmap Feature

## Overview

The **Experimental Pages** section is a new navigation category designed to house experimental and developmental features. The first sub-page in this section is the **Roadmap** page, which provides a comprehensive view of platform initiatives through Jira integration.

## Features

### Roadmap Page

The Roadmap page replicates the functionality from the legacy application with modern React implementation:

#### Key Features:
- **Assignee-based Initiative Loading**: Search and load Jira initiatives by assignee name (defaults to "Kevin Yu")
- **Real-time Search**: Filter initiatives by key, summary, description, or status
- **Status Filtering**: Filter by initiative status (Open, In Progress, Proposed, Committed, Done, Closed)
- **Sortable Columns**: Click column headers to sort by Key, Summary, Status, Created, or Updated date
- **CSV Export**: Export filtered data to CSV for reporting and analysis
- **Responsive Design**: Fully responsive layout with dark mode support
- **Loading States**: Clear loading, error, and empty state indicators

#### UI Components:
1. **Header**: Displays page title and last refresh timestamp
2. **Controls Section**:
   - Assignee input field with icon
   - Load Initiatives button
   - Search input with live filtering
   - Status dropdown filter
   - Refresh button
   - Export button
3. **Data Table**: Sortable table displaying:
   - Initiative Key (e.g., PLAT-001)
   - Summary and description
   - Status badge with color coding
   - Created and Updated dates

## Architecture

### Frontend Structure

```
frontend/src/
├── pages/
│   └── Roadmap.jsx          # Main Roadmap page component
├── components/
│   ├── common/
│   │   └── ProtectedRoute.jsx   # Page-level access control
│   └── layout/
│       └── Sidebar.jsx           # Navigation with Experimental Pages section
└── App.jsx                       # Route configuration
```

### Database Schema

The Experimental Pages feature adds two new page records:

1. **experimental** (Parent Page)
   - Name: `experimental`
   - Display Name: "Experimental Pages"
   - Route: `/experimental`
   - Type: Parent page with submenu

2. **experimental.roadmap** (Sub-page)
   - Name: `experimental.roadmap`
   - Display Name: "Roadmap"
   - Route: `/experimental/roadmap`
   - Parent: `experimental`

## Authorization & Permissions

### Page-Level Access Control

The Roadmap page is fully integrated with the application's authorization system:

1. **Database Integration**: 
   - Pages stored in `pages` table
   - Permissions managed via `role_pages` junction table

2. **Default Permissions**:
   - **Admin Role**: Full access to all experimental pages
   - **User Role**: Access to experimental pages (can be restricted via User Management)

3. **Dynamic Navigation**:
   - Sidebar automatically shows/hides based on user permissions
   - ProtectedRoute component enforces access control

### How to Manage Permissions

Users with admin access can manage page permissions via User Management:

1. Navigate to **User Management**
2. Select a role to edit
3. Toggle access to "Experimental Pages" or specific sub-pages
4. Changes take effect immediately for affected users

## Installation & Setup

### For New Installations

If you're setting up the database from scratch, the experimental pages will be automatically included when running the initialization scripts:

```bash
# Windows
.\database\install-windows-databases.ps1

# The script includes 10-experimental-pages.sql
```

### For Existing Installations

If you already have a database running, add the experimental pages:

```bash
# Connect to your PostgreSQL database and run:
psql -U postgres -d your_database_name -f database/add-experimental-pages.sql
```

Or manually via SQL:

```sql
-- Copy and paste the contents of database/add-experimental-pages.sql
```

### Verify Installation

Check if pages were added successfully:

```sql
SELECT name, display_name, route 
FROM pages 
WHERE name LIKE 'experimental%';
```

Expected output:
```
name                  | display_name       | route
----------------------|-------------------|---------------------
experimental          | Experimental Pages | /experimental
experimental.roadmap  | Roadmap           | /experimental/roadmap
```

## Usage

### Accessing the Roadmap Page

1. **Via Navigation**: Click "Experimental Pages" in the sidebar, then "Roadmap"
2. **Direct URL**: Navigate to `/experimental/roadmap`
3. **Keyboard Shortcut**: (Future enhancement)

### Loading Initiatives

1. Enter an assignee name in the input field (default: "Kevin Yu")
2. Click "Load Initiatives" or press Enter
3. View the results in the table below

### Filtering & Searching

- **Search**: Type in the search box to filter across all fields
- **Status Filter**: Select a status from the dropdown
- **Sorting**: Click any column header to sort

### Exporting Data

1. Filter data as desired
2. Click the "Export" button
3. CSV file downloads automatically with current date in filename

## API Integration

### Jira API Endpoint

The Roadmap page connects to:

```
POST /api/jira/initiatives
Content-Type: application/json

{
  "assigneeName": "Kevin Yu"
}
```

**Response Format:**
```json
{
  "issues": [
    {
      "key": "PLAT-001",
      "summary": "Initiative title",
      "description": "Initiative description",
      "status": "Committed",
      "created": "2025-01-10T09:00:00Z",
      "updated": "2025-01-18T14:30:00Z"
    }
  ]
}
```

### Error Handling

The page handles various error scenarios:
- **No assignee**: Prompts user to enter a name
- **Network errors**: Displays error message with retry option
- **Empty results**: Shows helpful "no data" message
- **API errors**: Displays server error message

## Customization

### Adding More Experimental Pages

To add additional pages under the Experimental section:

1. **Create React Component**: Add new page in `frontend/src/pages/`
2. **Add Route**: Update `frontend/src/App.jsx`
3. **Update Sidebar**: Add to `Sidebar.jsx` submenu
4. **Database Entry**: Add page to database:

```sql
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES 
    ('experimental.newpage', 'New Page', 'Description', 
        (SELECT id FROM pages WHERE name = 'experimental'), 
        '/experimental/newpage', 2, FALSE);
```

5. **Assign Permissions**: Add role_pages entries

### Removing Access

To restrict access to experimental pages:

**Via SQL:**
```sql
-- Remove access for user role
DELETE FROM role_pages 
WHERE role_id = (SELECT id FROM roles WHERE name = 'user')
  AND page_id IN (SELECT id FROM pages WHERE name LIKE 'experimental%');
```

**Via User Management UI:**
1. Go to User Management
2. Edit the "User" role
3. Uncheck "Experimental Pages"
4. Save changes

## Future Enhancements

Potential improvements for the Experimental Pages section:

- [ ] Add more experimental features (A/B testing, beta features)
- [ ] Enhanced Jira integration with more filters
- [ ] Initiative detail modal with full description
- [ ] Gantt chart view for roadmap visualization
- [ ] Comments and collaboration features
- [ ] Roadmap timeline view
- [ ] Custom status workflows
- [ ] Integration with other project management tools

## Troubleshooting

### Page Not Appearing in Sidebar

**Issue**: Experimental Pages section doesn't show in navigation

**Solutions**:
1. Verify database entries exist:
   ```sql
   SELECT * FROM pages WHERE name LIKE 'experimental%';
   ```
2. Check user has role_pages permission:
   ```sql
   SELECT * FROM role_pages rp
   JOIN pages p ON rp.page_id = p.id
   WHERE p.name = 'experimental';
   ```
3. Refresh browser and clear cache
4. Re-login to refresh user permissions

### Access Denied Error

**Issue**: "Access Denied" message when accessing /experimental/roadmap

**Solutions**:
1. Verify user role has permission
2. Check ProtectedRoute pageName matches database: `experimental.roadmap`
3. Ensure user is logged in
4. Check browser console for errors

### Jira Data Not Loading

**Issue**: Initiatives don't load or show error

**Solutions**:
1. Verify Jira API endpoint is configured
2. Check network tab for API errors
3. Test API endpoint directly with curl/Postman
4. Verify assignee name exists in Jira
5. Check server logs for API integration errors

## Technical Details

### Component Props

**Roadmap.jsx** (No props - self-contained)

**Route Configuration:**
```jsx
<Route 
  path="experimental/roadmap" 
  element={
    <ProtectedRoute pageName="experimental.roadmap">
      <Roadmap />
    </ProtectedRoute>
  } 
/>
```

### State Management

The Roadmap component manages the following state:
- `assigneeName`: Current assignee being searched
- `initiatives`: Full list of loaded initiatives
- `filteredInitiatives`: Filtered/searched subset
- `loading`: Loading state indicator
- `error`: Error message if any
- `searchTerm`: Current search filter
- `statusFilter`: Current status filter
- `sortConfig`: Current sort column and direction
- `lastRefresh`: Timestamp of last data load

### Styling

- Uses Tailwind CSS for styling
- Supports dark mode automatically
- Responsive breakpoints for mobile/tablet/desktop
- Heroicons for consistent icon design

## Security Considerations

1. **Authentication Required**: All routes protected by authentication
2. **Authorization Enforced**: Page-level permissions checked on every access
3. **Input Validation**: Assignee name sanitized before API calls
4. **XSS Protection**: React automatically escapes user input
5. **CSRF Protection**: API calls include authentication tokens
6. **SQL Injection**: Parameterized queries used in all database operations

## Related Documentation

- [Authentication System](../09-Authentication/README-AUTHENTICATION.md)
- [Page Entitlements System](../09-Authentication/PAGE-ENTITLEMENTS-SYSTEM.md)
- [User Management](../03-Features/User-Management-Documentation.md)
- [Jira Integration Guide](../05-Integrations/Jira-Integration-Guide.md)

## Change Log

### Version 1.0.0 (October 22, 2025)
- ✅ Initial implementation of Experimental Pages section
- ✅ Roadmap page with full feature parity to legacy app
- ✅ Integration with authorization system
- ✅ Database schema and migrations
- ✅ Documentation and setup scripts

## Support

For issues or questions:
1. Check this documentation
2. Review related documentation links above
3. Check troubleshooting section
4. Review GitHub issues (if applicable)
5. Contact development team

---

**Last Updated**: October 22, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready


