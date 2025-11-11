# Frontend Authentication Integration Guide

## ✅ Frontend Components Created

I've created complete, ready-to-use frontend components for authentication:

### 1. Core Utilities
- **`public/auth-utils.js`** - Authentication utility library

### 2. User Interface Pages
- **`public/login.html`** - Login page (already created)
- **`public/user-management.html`** - User management interface
- **`public/page-template-with-auth.html`** - Example authenticated page

## Quick Start

### Step 1: Use Login Page

The login page is already ready at `/login.html`. No changes needed!

Features:
- ✅ Username/password login
- ✅ Remember me checkbox (30-day sessions)
- ✅ Error handling
- ✅ Auto-redirect after login
- ✅ Beautiful, responsive design

### Step 2: Add Auth Utility to Your Existing Pages

Add this to the `<head>` section of your existing pages:

```html
<script src="/auth-utils.js"></script>
```

### Step 3: Protect Your Pages

Add this at the bottom of your page's `<script>` section:

```html
<script>
    let currentUser = null;

    async function initPage() {
        // Require authentication
        currentUser = await AuthUtils.requireAuth();
        if (!currentUser) return; // Will redirect to login

        // Display user info
        AuthUtils.renderUserInfo(currentUser, 'userInfo');

        // Show/hide admin features
        AuthUtils.applyRoleBasedVisibility(currentUser);

        // Your page initialization code here
        console.log('User logged in:', currentUser.username);
    }

    // Run on page load
    initPage();
</script>
```

## Using auth-utils.js Features

### 1. Require Authentication (Redirect if Not Logged In)

```javascript
// Redirects to login page if not authenticated
const user = await AuthUtils.requireAuth();
if (!user) return; // Will redirect

console.log('User is logged in:', user);
```

### 2. Optional Authentication Check (No Redirect)

```javascript
// Check without redirecting
const user = await AuthUtils.checkAuth();

if (user) {
    console.log('User is logged in:', user.username);
} else {
    console.log('User is not logged in');
}
```

### 3. Check User Role

```javascript
// Check if user is admin
if (AuthUtils.isAdmin(user)) {
    console.log('User is an admin');
}

// Check for specific role
if (AuthUtils.hasRole(user, 'admin')) {
    console.log('User has admin role');
}
```

### 4. Show/Hide Elements by Role

In your HTML, use `data-role` attributes:

```html
<!-- Visible to all authenticated users -->
<div>Everyone can see this</div>

<!-- Only visible to admins -->
<div data-role="admin">
    <h2>Admin Panel</h2>
    <button>Admin Action</button>
</div>
```

Then call in JavaScript:

```javascript
AuthUtils.applyRoleBasedVisibility(user);
```

### 5. Display User Information

In your HTML, add placeholders:

```html
<!-- Displays full name -->
<span data-user-name></span>

<!-- Displays username -->
<span data-user-username></span>

<!-- Or use a container for full user info widget -->
<div id="userInfo"></div>
```

Then call in JavaScript:

```javascript
// Renders user info with logout button
AuthUtils.renderUserInfo(user, 'userInfo');

// Or manually populate placeholders
AuthUtils.applyRoleBasedVisibility(user);
```

### 6. Logout

```javascript
// Simple logout
await AuthUtils.logout(); // Redirects to login

// Or add logout button in HTML
<button onclick="AuthUtils.logout()">Logout</button>
```

### 7. Handle API Responses

```javascript
const response = await fetch('/api/some-endpoint', {
    credentials: 'include' // Always include this!
});

// Handle 401/403 automatically
if (AuthUtils.handleUnauthorized(response)) {
    return; // Will redirect or show alert
}

// Continue with normal handling
const data = await response.json();
```

## Complete Example: Update Existing Page

### Before (No Authentication):

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
</head>
<body>
    <h1>Dashboard</h1>
    <div id="content"></div>
    
    <script>
        async function loadData() {
            const response = await fetch('/api/data');
            const data = await response.json();
            document.getElementById('content').textContent = JSON.stringify(data);
        }
        
        loadData();
    </script>
</body>
</html>
```

### After (With Authentication):

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
</head>
<body>
    <!-- Add user info display -->
    <div style="display: flex; justify-content: space-between; padding: 16px;">
        <h1>Dashboard</h1>
        <div id="userInfo"></div>
    </div>
    
    <div id="content"></div>
    
    <!-- Admin-only section -->
    <div data-role="admin">
        <h2>Admin Section</h2>
        <button onclick="adminAction()">Admin Action</button>
    </div>
    
    <!-- Include auth utils -->
    <script src="/auth-utils.js"></script>
    
    <script>
        let currentUser = null;
        
        async function initPage() {
            // Require authentication
            currentUser = await AuthUtils.requireAuth();
            if (!currentUser) return;
            
            // Show user info
            AuthUtils.renderUserInfo(currentUser, 'userInfo');
            
            // Show/hide based on role
            AuthUtils.applyRoleBasedVisibility(currentUser);
            
            // Load data
            await loadData();
        }
        
        async function loadData() {
            try {
                const response = await fetch('/api/data', {
                    credentials: 'include' // Add this!
                });
                
                // Handle auth errors
                if (AuthUtils.handleUnauthorized(response)) return;
                
                if (!response.ok) throw new Error('Failed to load');
                
                const data = await response.json();
                document.getElementById('content').textContent = JSON.stringify(data);
            } catch (error) {
                console.error('Error:', error);
            }
        }
        
        function adminAction() {
            alert('Admin action!');
        }
        
        // Initialize on load
        initPage();
    </script>
</body>
</html>
```

## User Management Page

Access the user management interface at:
```
http://localhost:8080/user-management.html
```

**Features:**
- ✅ List all users
- ✅ Create new users
- ✅ Edit user details
- ✅ Change user passwords
- ✅ Assign roles to users
- ✅ Activate/deactivate users
- ✅ Delete users
- ✅ Admin-only access

**Usage:**
1. Login as admin
2. Navigate to `/user-management.html`
3. Click "Create User" to add new users
4. Click "Edit" to modify user details
5. Click "Password" to change a user's password
6. Click "Delete" to remove users (cannot delete yourself)

## Best Practices

### 1. Always Include Credentials

When making API calls, always include credentials:

```javascript
fetch('/api/endpoint', {
    credentials: 'include' // Essential for cookies!
})
```

### 2. Check Authentication on Page Load

```javascript
async function init() {
    const user = await AuthUtils.requireAuth();
    if (!user) return;
    
    // Your initialization code
}

init();
```

### 3. Use data-role for Conditional Rendering

```html
<!-- Instead of JavaScript show/hide -->
<div data-role="admin">Admin content</div>

<!-- Then just call once -->
<script>
AuthUtils.applyRoleBasedVisibility(user);
</script>
```

### 4. Handle Errors Gracefully

```javascript
try {
    const response = await fetch('/api/endpoint', {
        credentials: 'include'
    });
    
    if (AuthUtils.handleUnauthorized(response)) return;
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    // Use data
} catch (error) {
    console.error('Error:', error);
    alert('Operation failed');
}
```

### 5. Test Both Roles

Always test your pages with:
- ✅ Admin user (can see admin sections)
- ✅ Regular user (admin sections hidden)
- ✅ No authentication (redirects to login)

## Common Patterns

### Pattern 1: Navigation with User Info

```html
<nav style="display: flex; justify-content: space-between; padding: 16px;">
    <div>
        <a href="/">Home</a>
        <a href="/data.html">Data</a>
        <a href="/user-management.html" data-role="admin">Users</a>
    </div>
    <div id="userInfo"></div>
</nav>

<script>
async function init() {
    const user = await AuthUtils.requireAuth();
    if (!user) return;
    AuthUtils.renderUserInfo(user, 'userInfo');
    AuthUtils.applyRoleBasedVisibility(user);
}
init();
</script>
```

### Pattern 2: Admin-Only Page

```html
<script>
async function init() {
    const user = await AuthUtils.requireAuth();
    if (!user) return;
    
    // Check if admin
    if (!AuthUtils.isAdmin(user)) {
        alert('Access denied. Admin role required.');
        window.location.href = '/';
        return;
    }
    
    // Admin user confirmed, proceed
    loadAdminData();
}
init();
</script>
```

### Pattern 3: Conditional Features

```javascript
async function init() {
    const user = await AuthUtils.requireAuth();
    if (!user) return;
    
    // Load basic features for all users
    loadBasicFeatures();
    
    // Load admin features if admin
    if (AuthUtils.isAdmin(user)) {
        loadAdminFeatures();
    }
}
```

## Files You Created

### JavaScript Files
```
public/
├── auth-utils.js                    # Authentication utilities
├── login.html                       # Login page ✅
├── user-management.html             # User management UI ✅
└── page-template-with-auth.html     # Example template ✅
```

## Next Steps

### 1. Update Your Existing Pages

For each existing page (e.g., `index.html`, `analytics.html`):

1. Add `<script src="/auth-utils.js"></script>`
2. Add user info container: `<div id="userInfo"></div>`
3. Add init function with `AuthUtils.requireAuth()`
4. Add `credentials: 'include'` to all fetch calls
5. Mark admin sections with `data-role="admin"`

### 2. Test the Flow

1. Visit any page → Should redirect to login
2. Login as admin → Should see all content
3. Login as regular user → Admin sections hidden
4. Logout → Redirects to login

### 3. Customize Styling

The components use inline styles for simplicity. You can:
- Extract to external CSS files
- Customize colors and layouts
- Match your existing design system

## Summary

✅ **`auth-utils.js`** - Drop-in authentication library  
✅ **`login.html`** - Ready-to-use login page  
✅ **`user-management.html`** - Full user management UI  
✅ **`page-template-with-auth.html`** - Example to copy  

**Integration is as simple as:**
```html
<script src="/auth-utils.js"></script>
<script>
    const user = await AuthUtils.requireAuth();
    AuthUtils.renderUserInfo(user, 'userInfo');
    AuthUtils.applyRoleBasedVisibility(user);
</script>
```

**You're ready to add authentication to all your pages!** 🎉

See `page-template-with-auth.html` for a complete working example.

