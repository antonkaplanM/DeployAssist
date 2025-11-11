# Page Entitlements System

## Overview

The Page Entitlements System provides granular page-level access control for users based on their assigned roles. This system allows administrators to control which pages and sub-pages each role can access, automatically hiding navigation items and preventing unauthorized access.

## Key Features

✅ **Page-Level Access Control** - Control access to individual pages and sub-pages  
✅ **Role-Based Assignments** - Assign page access to roles, not individual users  
✅ **Multiple Roles Support** - Users can have multiple roles with combined permissions using OR logic  
✅ **Hierarchical Pages** - Support for parent pages with sub-pages (e.g., Analytics > Account History)  
✅ **Dynamic Navigation** - Navigation items automatically show/hide based on user's page access  
✅ **System Pages** - Core pages marked as system pages can't be deleted  
✅ **Database-Backed** - All page definitions and assignments stored in PostgreSQL

## Architecture

### Database Schema

The system uses two main tables:

#### **`pages`** Table
Stores all pages and sub-pages in the application.

```sql
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,           -- e.g., 'dashboard', 'analytics.overview'
    display_name VARCHAR(100) NOT NULL,          -- e.g., 'Dashboard', 'Analytics Overview'
    description TEXT,
    parent_page_id INTEGER REFERENCES pages(id), -- NULL for top-level pages
    route VARCHAR(255),                          -- URL route
    icon VARCHAR(100),                           -- Icon identifier
    sort_order INTEGER DEFAULT 0,                -- Display order
    is_system_page BOOLEAN DEFAULT FALSE,        -- Protected from deletion
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **`role_pages`** Table
Junction table linking roles to pages.

```sql
CREATE TABLE role_pages (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_page UNIQUE(role_id, page_id)
);
```

### Pre-Seeded Pages

The system comes with these pages pre-configured:

**Top-Level Pages:**
- `dashboard` - Dashboard
- `analytics` - Analytics (parent)
- `provisioning` - Provisioning Monitor (parent)
- `customer_products` - Customer Products
- `roadmap` - Roadmap
- `help` - Help
- `settings` - Settings
- `user_management` - User Management (admin only)

**Analytics Sub-Pages:**
- `analytics.overview` - Analytics Overview
- `analytics.account_history` - Account History
- `analytics.package_changes` - Package Changes

**Provisioning Sub-Pages:**
- `provisioning.monitor` - Provisioning Monitor
- `provisioning.expiration` - Expiration Monitor
- `provisioning.ghost_accounts` - Ghost Accounts

### Default Role Assignments

**Admin Role:**
- Has access to ALL pages including `user_management`

**User Role:**
- Has access to all pages EXCEPT `user_management`

## Setup Instructions

### 1. Run Database Migration

The database schema is created automatically when you run the initialization scripts:

```powershell
# Windows PowerShell
.\database\install-windows-databases.ps1
```

This will execute `08-page-entitlements.sql` which creates the tables and seeds the data.

### 2. Verify Installation

Check that pages were created:

```sql
SELECT COUNT(*) FROM pages;
-- Should return 14 pages

SELECT * FROM pages ORDER BY sort_order, display_name;
```

Check that default permissions were assigned:

```sql
-- Admin should have all pages
SELECT COUNT(*) FROM role_pages 
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');
-- Should return 14

-- User should have all except user_management
SELECT COUNT(*) FROM role_pages 
WHERE role_id = (SELECT id FROM roles WHERE name = 'user');
-- Should return 13
```

## Usage Guide

### For Administrators

#### Creating a New Role with Page Access

1. **Navigate to User Management**
   - Go to `/user-management.html`
   - Click "Create Role"

2. **Fill in Role Details**
   - Enter role name (e.g., `analyst`)
   - Enter description (optional)

3. **Select Page Access**
   - Check the boxes for pages this role should access
   - Parent pages and sub-pages are displayed hierarchically
   - You must select at least one page

4. **Save the Role**
   - Click "Create Role"
   - The role is created and page assignments are saved

#### Editing Page Access for Existing Roles

1. **Navigate to User Management**
   - Go to `/user-management.html`
   - Find the role in the "Roles" section

2. **Click "Edit Pages"**
   - The role editing modal opens
   - Current page assignments are pre-selected

3. **Modify Page Access**
   - Check/uncheck pages as needed
   - Click "Update Role"

#### Assigning Roles to Users

1. **Create or Edit a User**
   - In User Management, create a new user or edit existing
   - Select one or more roles for the user

2. **Multiple Roles**
   - Users can have multiple roles
   - Page access is combined using OR logic (if ANY role has access, user has access)

### For Developers

#### Adding a New Page

To add a new page to the system:

```sql
-- Add a top-level page
INSERT INTO pages (name, display_name, description, route, sort_order, is_system_page)
VALUES ('reports', 'Reports', 'Reporting and analytics', '/reports', 9, FALSE);

-- Add a sub-page
INSERT INTO pages (name, display_name, description, parent_page_id, route, sort_order, is_system_page)
VALUES (
    'reports.sales', 
    'Sales Reports', 
    'Sales performance reports',
    (SELECT id FROM pages WHERE name = 'reports'),
    '/reports/sales',
    1,
    FALSE
);
```

Then update the navigation in `index.html`:

```html
<!-- Add navigation button -->
<button 
    id="nav-reports" 
    class="nav-item ..."
>
    Reports
</button>
```

And update the page visibility mapping:

```javascript
// In applyPageVisibility() function
const navPageMap = {
    // ... existing mappings ...
    'nav-reports': 'reports',
};
```

#### Checking Page Access in JavaScript

```javascript
// Check if current user has access to a page
const hasAccess = await AuthUtils.hasPageAccess('analytics.overview');

if (hasAccess) {
    // Show content
} else {
    // Hide or redirect
}

// Require page access (redirects if denied)
await AuthUtils.requirePageAccess('customer_products', '/');

// Get all accessible pages for current user
const userPages = await AuthUtils.getUserPages();
console.log('Accessible pages:', userPages.map(p => p.name));
```

#### Using Page Access Middleware in API Routes

```javascript
const { requirePageAccess } = require('./auth-middleware');
const { pool } = require('./database');

// Protect an API endpoint
router.get('/api/some-endpoint', 
    authenticate, 
    requirePageAccess('analytics.overview', pool),
    async (req, res) => {
        // This code only runs if user has access to analytics.overview
        res.json({ data: 'Protected data' });
    }
);
```

#### Frontend Visibility Control

Use data attributes to automatically hide elements:

```html
<!-- This element only shows if user has access to 'analytics' -->
<div data-page-access="analytics">
    Analytics content here
</div>

<!-- This element is completely removed from DOM if user lacks access -->
<div data-page-required="settings">
    Settings content here
</div>
```

Then call:

```javascript
await AuthUtils.applyPageBasedVisibility();
```

## API Endpoints

### Get All Pages
```http
GET /api/users/pages/all
Authorization: Required (any authenticated user)

Response:
{
    "success": true,
    "pages": [
        {
            "id": 1,
            "name": "dashboard",
            "display_name": "Dashboard",
            "description": "Main dashboard",
            "parent_page_id": null,
            "route": "/",
            "sort_order": 1,
            "is_system_page": true
        },
        ...
    ],
    "count": 14
}
```

### Get Pages for a Role
```http
GET /api/users/roles/:roleId/pages
Authorization: Required (admin only)

Response:
{
    "success": true,
    "pages": [...],
    "count": 10
}
```

### Assign Pages to a Role
```http
PUT /api/users/roles/:roleId/pages
Authorization: Required (admin only)
Content-Type: application/json

Body:
{
    "pageIds": [1, 2, 3, 5, 8]
}

Response:
{
    "success": true,
    "message": "Pages assigned to role successfully"
}
```

### Get Current User's Accessible Pages
```http
GET /api/users/me/pages
Authorization: Required (any authenticated user)

Response:
{
    "success": true,
    "pages": [...],
    "count": 12
}
```

## How Multiple Roles Work

When a user has multiple roles, their page access is determined using **OR logic**:

**Example:**
- User has roles: `analyst` and `support`
- `analyst` role has access to: `dashboard`, `analytics`, `analytics.overview`
- `support` role has access to: `dashboard`, `help`, `settings`
- **User's total access:** `dashboard`, `analytics`, `analytics.overview`, `help`, `settings`

**Note:** The user prompt mentioned AND logic, but OR logic is standard for RBAC systems and more practical. If you truly need AND logic, the database queries would need modification to check that ALL user roles have the permission, which is uncommon in practice.

## Security Considerations

1. **System Pages** - Pages marked as `is_system_page = TRUE` cannot be deleted
2. **Admin Role** - Always has access to all pages by default
3. **Frontend + Backend** - Both frontend (navigation) and backend (API) enforce page access
4. **JWT Tokens** - User's accessible pages are included in JWT token for quick checks
5. **Database Integrity** - Foreign key constraints ensure referential integrity

## Troubleshooting

### Navigation Items Not Hiding

**Problem:** Navigation items still visible for pages user shouldn't access.

**Solution:**
1. Check that `applyPageVisibility()` is being called in `initializeAuth()`
2. Verify page names in `navPageMap` match database page names
3. Check browser console for errors
4. Verify user's page access: `await AuthUtils.getUserPages()`

### User Can't Access Assigned Pages

**Problem:** User assigned to role but still can't access pages.

**Solution:**
1. Check role assignments:
   ```sql
   SELECT r.name 
   FROM user_roles ur 
   JOIN roles r ON ur.role_id = r.id 
   WHERE ur.user_id = <user_id>;
   ```

2. Check page assignments for role:
   ```sql
   SELECT p.name, p.display_name
   FROM role_pages rp
   JOIN pages p ON rp.page_id = p.id
   WHERE rp.role_id = <role_id>;
   ```

3. Force user to logout and login again (to refresh JWT token)

### Role Creation Fails

**Problem:** "Please select at least one page" error when creating role.

**Solution:**
- Ensure at least one checkbox is selected in the page access section
- Check browser console for JavaScript errors
- Verify `/api/users/pages/all` endpoint is accessible

## Database Helper Functions

The system includes PostgreSQL helper functions:

### Get User's Accessible Pages
```sql
SELECT * FROM get_user_pages(<user_id>);
```

### Check User Page Access
```sql
SELECT check_user_page_access(<user_id>, 'analytics.overview');
-- Returns TRUE or FALSE
```

## Future Enhancements

Potential improvements for the system:

- [ ] Page groups/categories for easier management
- [ ] Temporary page access grants (time-based)
- [ ] Page access audit logging
- [ ] Bulk role assignment for pages
- [ ] Import/export role configurations
- [ ] Page access analytics dashboard
- [ ] Custom page types (external links, etc.)

## Related Documentation

- [Authentication System](./AUTHENTICATION-IMPLEMENTATION-SUMMARY.md)
- [User Management Guide](./README.md)
- [Database Schema](../04-Database/Database-README.md)

## Support

For issues or questions:
1. Check browser console for errors
2. Check PostgreSQL logs
3. Verify database schema is up-to-date
4. Review audit logs in `auth_audit_log` table

