# Authorization Flow Fix - Page-Level Access Control

## Overview
Fixed the authorization flow to properly restrict page access based on user permissions. Users now only see and can access pages they have been granted permission to through their role assignments.

## Problem Statement

**Before:**
- Users could see all navigation items regardless of permissions
- Users could access pages directly via URL even without permission
- Pages would load but data wouldn't display, causing confusion
- No proper page-level authorization enforcement

**After:**
- Users only see navigation items they have access to
- Direct URL access is blocked for unauthorized pages
- Clear "Access Denied" message for unauthorized access attempts
- Proper page-level authorization at the route level

## Changes Made

### 1. AuthContext Enhancement (`frontend/src/context/AuthContext.jsx`)

**Added User Pages State:**
```javascript
const [userPages, setUserPages] = useState([]);
```

**Fetch Pages on Login/Load:**
- Calls `/api/users/me/pages` endpoint to get user's accessible pages
- Stores pages in state for quick access checks

**New Helper Functions:**
```javascript
hasPageAccess(pageName) // Check if user can access a specific page
getAccessiblePages()     // Get list of all accessible pages
```

**Updated Context Value:**
```javascript
{ user, userPages, login, logout, loading, hasPageAccess, getAccessiblePages }
```

### 2. AuthService Update (`frontend/src/services/authService.js`)

**Added New Method:**
```javascript
async getUserPages() {
  const response = await api.get('/users/me/pages');
  return response.data;
}
```

This method fetches the user's accessible pages from the backend.

### 3. ProtectedRoute Enhancement (`frontend/src/components/common/ProtectedRoute.jsx`)

**Added Page-Level Protection:**
- Now accepts optional `pageName` prop
- Checks user authentication (existing)
- **NEW:** Checks page-level permissions when `pageName` is provided

**Access Denied UI:**
Shows a proper error page when user doesn't have access:
- Warning icon
- "Access Denied" heading
- Clear message
- Link back to dashboard

**Usage:**
```jsx
// Just authentication
<ProtectedRoute>
  <MainLayout />
</ProtectedRoute>

// Authentication + page permission
<ProtectedRoute pageName="dashboard">
  <Dashboard />
</ProtectedRoute>
```

### 4. Sidebar Navigation Filter (`frontend/src/components/layout/Sidebar.jsx`)

**Added Page Name Mapping:**
Each navigation item now includes its corresponding database page name:
```javascript
{
  name: 'Dashboard',
  path: '/',
  icon: HomeIcon,
  pageName: 'dashboard'  // Maps to database page name
}
```

**Dynamic Filtering with useMemo:**
```javascript
const navItems = useMemo(() => {
  return allNavItems
    .map(item => {
      if (item.submenu) {
        // Filter submenu items based on access
        const accessibleSubmenu = item.submenu.filter(subItem => 
          hasPageAccess(subItem.pageName)
        );
        // Only show parent if at least one submenu is accessible
        return accessibleSubmenu.length > 0 
          ? { ...item, submenu: accessibleSubmenu } 
          : null;
      }
      // Check direct page access
      return hasPageAccess(item.pageName) ? item : null;
    })
    .filter(Boolean);
}, [hasPageAccess]);
```

**Smart Submenu Handling:**
- Parent menu items (Analytics, Provisioning) only show if user has access to at least one child page
- Submenu items are individually filtered
- Empty parent sections are hidden completely

### 5. Route Protection (`frontend/src/App.jsx`)

**Every Route Now Protected:**
Each route now wraps its component with `ProtectedRoute` and specifies the required page name:

```jsx
<Route 
  path="analytics/account-history" 
  element={
    <ProtectedRoute pageName="analytics.account_history">
      <AccountHistory />
    </ProtectedRoute>
  } 
/>
```

**Page Name Mapping:**
| Route | Page Name |
|-------|-----------|
| `/` | `dashboard` |
| `/analytics` | `analytics.overview` |
| `/analytics/account-history` | `analytics.account_history` |
| `/analytics/package-changes` | `analytics.package_changes` |
| `/provisioning` | `provisioning.monitor` |
| `/provisioning/expiration` | `provisioning.expiration` |
| `/provisioning/ghost-accounts` | `provisioning.ghost_accounts` |
| `/provisioning/audit-trail` | `provisioning.audit_trail` |
| `/customer-products` | `customer_products` |
| `/users` | `user_management` |
| `/settings` | `settings` |

## Database Schema Reference

The page names correspond to entries in the `pages` table:

**Top-Level Pages:**
- `dashboard`
- `analytics`
- `provisioning`
- `customer_products`
- `roadmap`
- `help`
- `settings`
- `user_management`

**Analytics Sub-Pages:**
- `analytics.overview`
- `analytics.account_history`
- `analytics.package_changes`

**Provisioning Sub-Pages:**
- `provisioning.monitor`
- `provisioning.expiration`
- `provisioning.ghost_accounts`
- `provisioning.audit_trail`

## User Flow Examples

### Example 1: Standard User (No User Management Access)

**Permissions:**
- Has access to all pages EXCEPT `user_management`

**Experience:**
1. Logs in successfully
2. Sidebar shows: Dashboard, Analytics, Provisioning, Customer Products, Settings
3. Sidebar does NOT show: User Management
4. Can navigate to all visible pages normally
5. If tries to access `/users` directly:
   - Shown "Access Denied" page
   - Cannot view or interact with user management

### Example 2: Admin User

**Permissions:**
- Has access to ALL pages including `user_management`

**Experience:**
1. Logs in successfully
2. Sidebar shows: Dashboard, Analytics, Provisioning, Customer Products, User Management, Settings
3. Can access all pages without restriction

### Example 3: Limited Analytics User

**Permissions:**
- Has access to: `dashboard`, `analytics.account_history`
- No access to: package changes, provisioning, user management, etc.

**Experience:**
1. Logs in successfully
2. Sidebar shows:
   - Dashboard
   - Analytics (with only "Account History" in submenu)
3. Clicking "Analytics" dropdown shows only "Account History"
4. Other pages are completely hidden
5. Attempting direct URL access results in "Access Denied"

## Security Features

### Multi-Layer Protection

1. **Backend API Protection** (existing)
   - All API endpoints require authentication
   - Role-based permissions enforced
   
2. **Route-Level Protection** (new)
   - Every route checks page permissions
   - Unauthorized access blocked before component loads
   
3. **UI Filtering** (new)
   - Navigation only shows accessible items
   - Reduces confusion and unauthorized access attempts

### Defense in Depth

Even if a user:
- Manually types a URL
- Modifies the frontend code
- Uses browser dev tools

They still **cannot access** pages they don't have permission for because:
1. Route protection blocks rendering
2. Backend APIs reject unauthorized requests
3. Database enforces role-page relationships

## Performance Considerations

### Optimizations

1. **Single Page Fetch:**
   - User pages fetched once on login
   - Cached in AuthContext for duration of session
   - No per-route API calls

2. **useMemo for Navigation:**
   - Navigation filtering memoized
   - Only recalculates when `hasPageAccess` changes
   - Prevents unnecessary re-renders

3. **Efficient Permission Checks:**
   - Simple array lookup: `userPages.some(page => page.name === pageName)`
   - O(n) complexity, but n is small (< 20 pages)

## Testing Checklist

### User Permissions

- [ ] **Admin User**
  - [ ] Can see all navigation items
  - [ ] Can access all pages
  - [ ] User Management is visible and accessible

- [ ] **Standard User**
  - [ ] Can see most navigation items
  - [ ] Cannot see User Management in sidebar
  - [ ] Attempting to access `/users` shows Access Denied
  - [ ] Can access Dashboard, Analytics, Provisioning, Customer Products

- [ ] **Custom Role User**
  - [ ] Create custom role with limited page access
  - [ ] Assign role to test user
  - [ ] Verify only granted pages appear in sidebar
  - [ ] Verify direct URL access is blocked for non-granted pages

### Navigation Filtering

- [ ] **Analytics Submenu**
  - [ ] If user has access to all: shows Overview, Account History, Package Changes
  - [ ] If user has partial access: shows only accessible items
  - [ ] If user has no access: entire Analytics section hidden

- [ ] **Provisioning Submenu**
  - [ ] If user has access to all: shows all 4 sub-pages
  - [ ] If user has partial access: shows only accessible items
  - [ ] If user has no access: entire Provisioning section hidden

### Direct URL Access

- [ ] **Unauthorized Page Access**
  - [ ] Navigate to protected page URL without permission
  - [ ] Verify "Access Denied" page displays
  - [ ] Verify "Go to Dashboard" link works
  - [ ] Verify no data is loaded or displayed

- [ ] **Authorized Page Access**
  - [ ] Navigate to protected page URL with permission
  - [ ] Verify page loads normally
  - [ ] Verify data displays correctly

### Edge Cases

- [ ] **Session Expiry**
  - [ ] Login as user with limited permissions
  - [ ] Wait for session to expire
  - [ ] Verify redirect to login page
  - [ ] Verify permissions reapplied after re-login

- [ ] **Role Changes**
  - [ ] Admin removes page access from user's role
  - [ ] User refreshes page
  - [ ] Verify removed pages no longer visible
  - [ ] Verify user logged out and must re-login (session invalidation)

- [ ] **Empty Permissions**
  - [ ] User with no page assignments
  - [ ] Verify minimal navigation (just dashboard)
  - [ ] Verify graceful handling

## Migration Guide

### For Existing Users

**No Action Required:**
- Existing role assignments automatically work
- Admin users retain full access
- Standard users retain access to all pages except user management
- Custom roles work as configured

### For New Installations

1. **Database Setup:**
   - Run migration script `08-page-entitlements.sql`
   - Pages and role_pages tables created automatically
   - Default permissions assigned to admin and user roles

2. **Role Configuration:**
   - Use User Management page to create custom roles
   - Assign page permissions through the UI
   - Changes take effect immediately

## Files Modified

1. **`frontend/src/context/AuthContext.jsx`** - Added user pages state and helper functions
2. **`frontend/src/services/authService.js`** - Added getUserPages method
3. **`frontend/src/components/common/ProtectedRoute.jsx`** - Added page-level permission check
4. **`frontend/src/components/layout/Sidebar.jsx`** - Added navigation filtering based on permissions
5. **`frontend/src/App.jsx`** - Added page name to each protected route

## API Endpoints Used

- **`GET /api/users/me/pages`** - Fetch current user's accessible pages
  - Returns: `{ success: true, pages: [...], count: number }`
  - Already implemented in backend (user-routes.js)

## Troubleshooting

### Issue: User can't see any pages after login

**Cause:** User has no page assignments

**Solution:**
1. Login as admin
2. Go to User Management
3. Edit the user's roles
4. Ensure assigned roles have page permissions

### Issue: Navigation items disappear unexpectedly

**Cause:** Role's page assignments were modified

**Solution:**
1. User should logout and login again
2. Or admin should verify role page assignments in User Management

### Issue: "Access Denied" on pages user should have access to

**Cause:** Page name mismatch or database inconsistency

**Solution:**
1. Verify page names in `pages` table match code mappings
2. Check `role_pages` assignments for user's roles
3. Verify API response from `/api/users/me/pages`

## Summary

✅ **Proper authorization flow implemented**
- Users only see pages they have access to
- Direct URL access properly blocked
- Clear error messages for unauthorized access
- Performance optimized with caching and memoization

✅ **Security enhanced**
- Multi-layer protection (UI, routes, backend)
- Defense in depth approach
- No sensitive data exposed to unauthorized users

✅ **User experience improved**
- Clean, personalized navigation
- No confusion from inaccessible pages
- Professional access denied messaging

**Status: Ready for Testing** 🎉


