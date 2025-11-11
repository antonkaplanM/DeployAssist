# Experimental Pages - Quick Setup Summary

## What Was Created

A new "Experimental Pages" section with a "Roadmap" sub-page that replicates the functionality from the old application. This page is fully integrated with the authentication and authorization system.

## Files Created/Modified

### Frontend Files
1. **`frontend/src/pages/Roadmap.jsx`** ✨ NEW
   - Complete Roadmap page implementation
   - Jira integration for loading initiatives
   - Search, filter, sort, and export functionality
   - Responsive design with dark mode support

2. **`frontend/src/App.jsx`** ✏️ MODIFIED
   - Added import for Roadmap component
   - Added route: `/experimental/roadmap` with ProtectedRoute wrapper
   - Page name: `experimental.roadmap`

3. **`frontend/src/components/layout/Sidebar.jsx`** ✏️ MODIFIED
   - Added "Experimental Pages" navigation section
   - Added expandable/collapsible submenu
   - Added state management for experimental section
   - Added "Roadmap" as first sub-page

### Database Files
1. **`database/init-scripts/10-experimental-pages.sql`** ✨ NEW
   - Creates `experimental` parent page
   - Creates `experimental.roadmap` sub-page
   - Assigns permissions to admin and user roles
   - Includes logging and verification

2. **`database/add-experimental-pages.sql`** ✨ NEW
   - Quick migration script for existing databases
   - Can be run independently to add pages
   - Includes verification queries

### Documentation
1. **`Technical Documentation/03-Features/Experimental-Pages-Roadmap.md`** ✨ NEW
   - Comprehensive feature documentation
   - Setup and installation instructions
   - Usage guide and API details
   - Troubleshooting section

## Quick Setup Steps

### For New Installations
If setting up database from scratch, the experimental pages will be included automatically:

```bash
# Run the full database initialization
.\database\install-windows-databases.ps1
```

### For Existing Installations
If you already have a running database, add the experimental pages:

```bash
# Option 1: Using psql
psql -U postgres -d your_database_name -f database/add-experimental-pages.sql

# Option 2: Using pgAdmin
# Open pgAdmin, connect to your database, and execute the contents of:
# database/add-experimental-pages.sql
```

### Verify Installation

**Check Database:**
```sql
SELECT name, display_name, route 
FROM pages 
WHERE name LIKE 'experimental%';
```

Expected output:
```
experimental          | Experimental Pages | /experimental
experimental.roadmap  | Roadmap           | /experimental/roadmap
```

**Check Application:**
1. Start the application
2. Login with any user account
3. Look for "Experimental Pages" in the left sidebar
4. Click to expand and see "Roadmap" sub-page
5. Navigate to Roadmap page

## Page Structure

```
Experimental Pages (Parent)
└── Roadmap (Sub-page)
    ├── Load Jira initiatives by assignee
    ├── Search and filter initiatives
    ├── Sort by any column
    └── Export to CSV
```

## Authorization Model

### Database Structure
- **Table**: `pages` - Stores page definitions
- **Table**: `role_pages` - Junction table for role-to-page mapping
- **Function**: `get_user_pages(user_id)` - Returns accessible pages for user
- **Function**: `check_user_page_access(user_id, page_name)` - Checks access

### Default Permissions
- **Admin Role**: ✅ Full access to all experimental pages
- **User Role**: ✅ Access to experimental pages (can be restricted)

### Managing Permissions

**Via User Management UI:**
1. Navigate to User Management (admin only)
2. Edit a role
3. Toggle access to "Experimental Pages"
4. Changes apply immediately

**Via SQL (Direct):**
```sql
-- Grant access to a role
INSERT INTO role_pages (role_id, page_id)
SELECT r.id, p.id FROM roles r, pages p
WHERE r.name = 'user' AND p.name = 'experimental.roadmap';

-- Revoke access from a role
DELETE FROM role_pages 
WHERE role_id = (SELECT id FROM roles WHERE name = 'user')
  AND page_id = (SELECT id FROM pages WHERE name = 'experimental.roadmap');
```

## Features

### Roadmap Page Features
✅ Assignee-based search (defaults to "Kevin Yu")  
✅ Live search across all fields  
✅ Status filtering dropdown  
✅ Sortable columns (Key, Summary, Status, Created, Updated)  
✅ CSV export with filtered data  
✅ Responsive design  
✅ Dark mode support  
✅ Loading states  
✅ Error handling  
✅ Empty state messaging  

## API Integration

The Roadmap page connects to the Jira API endpoint:

```
POST /api/jira/initiatives
Content-Type: application/json

Body: { "assigneeName": "Kevin Yu" }
```

## How to Use

1. **Access Page**: Click "Experimental Pages" → "Roadmap" in sidebar
2. **Load Data**: Enter assignee name (default: Kevin Yu) and click "Load Initiatives"
3. **Search**: Type in search box to filter results
4. **Filter**: Select status from dropdown
5. **Sort**: Click column headers to sort
6. **Export**: Click "Export" button to download CSV

## Key Technical Details

### Route Configuration
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

### Navigation Configuration
```jsx
{
  name: 'Experimental Pages',
  icon: ChartBarIcon,
  pageName: 'experimental',
  submenu: [
    { 
      name: 'Roadmap', 
      path: '/experimental/roadmap',
      pageName: 'experimental.roadmap'
    }
  ]
}
```

### Database Page Names
- Parent: `experimental`
- Sub-page: `experimental.roadmap`

**Important**: The `pageName` prop in ProtectedRoute must match the database `name` field exactly!

## Adding More Experimental Pages

To add additional pages to the Experimental section:

1. **Create Component**: Add React component in `frontend/src/pages/`
2. **Add Route**: Add route in `App.jsx` with ProtectedRoute
3. **Update Sidebar**: Add to submenu in `Sidebar.jsx`
4. **Add to Database**:
   ```sql
   INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order)
   VALUES ('experimental.newpage', 'New Page', 'Description', 
           (SELECT id FROM pages WHERE name = 'experimental'), 
           '/experimental/newpage', 2);
   ```
5. **Assign Permissions**: Add role_pages entries

## Testing Checklist

After setup, verify:

- [ ] Sidebar shows "Experimental Pages" section
- [ ] "Experimental Pages" expands to show "Roadmap"
- [ ] Clicking "Roadmap" navigates to `/experimental/roadmap`
- [ ] Page loads without errors
- [ ] Can enter assignee name and load initiatives
- [ ] Search functionality works
- [ ] Status filter works
- [ ] Sorting by clicking columns works
- [ ] Export button downloads CSV
- [ ] Dark mode toggles properly
- [ ] Responsive on mobile/tablet
- [ ] Access control works (try different roles)
- [ ] ProtectedRoute blocks unauthorized access

## Troubleshooting

**Page not showing in sidebar?**
- Check database: `SELECT * FROM pages WHERE name LIKE 'experimental%'`
- Check permissions: `SELECT * FROM role_pages WHERE page_id IN (SELECT id FROM pages WHERE name LIKE 'experimental%')`
- Clear browser cache and re-login

**Access Denied error?**
- Verify user has permission via User Management
- Check pageName in route matches database exactly
- Ensure user is logged in

**Jira data not loading?**
- Check API endpoint configuration
- Verify assignee name exists in Jira
- Check browser console and network tab for errors

## Next Steps

1. Run database migration (if needed)
2. Test the new page functionality
3. Configure Jira API integration (if not already done)
4. Review and adjust permissions as needed
5. Consider adding more experimental features

## Documentation

Full documentation available at:
- `Technical Documentation/03-Features/Experimental-Pages-Roadmap.md`

## Status

✅ **COMPLETE** - All components implemented and integrated  
✅ **TESTED** - No linting errors  
✅ **DOCUMENTED** - Full documentation provided  
✅ **READY** - Ready for database migration and testing  

---

**Created**: October 22, 2025  
**Version**: 1.0.0  
**Author**: AI Assistant

