# Authentication System Quick Start Guide

## 🎉 Implementation Complete!

Your authentication and user management system is now fully implemented and ready to use.

## What You Have Now

✅ **Secure Backend Authentication System**
- JWT-based authentication
- Role-based access control (Admin & User roles)
- Session management with inactivity timeout
- Password hashing with bcrypt
- Account lockout protection
- Comprehensive audit logging
- "Remember me" functionality

✅ **Complete API**
- Login/Logout
- User management
- Role management
- Password changes
- Audit logs

✅ **Protected Routes**
- All existing routes (Salesforce, SML) now require authentication
- Role-based access control ready for future features

✅ **Simple Login Page**
- Responsive design
- Error handling
- Remember me checkbox
- Auto-redirect after login

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to your `.env` file:
```bash
# Copy this line and replace with your generated secret
JWT_SECRET=your_generated_secret_here

# Set a secure admin password
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123!

# Optional: customize admin username
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_FULL_NAME=System Administrator
```

### Step 3: Run Database Migration

```bash
# Using psql
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql

# Or copy/paste the SQL into your preferred database client
```

### Step 4: Create Admin User

```bash
node setup-admin-user.js
```

You should see:
```
✅ Default admin user setup complete!

📋 Admin User Details:
   Username: admin
   Full Name: System Administrator
   Role: admin
```

### Step 5: Build and Start

```bash
# Build TypeScript
npm run build

# Start the server
npm run start:ts
```

## Test Your Authentication

### 1. Visit the Login Page

Open your browser to: `http://localhost:8080/login.html`

### 2. Login with Admin Credentials

- **Username**: `admin`
- **Password**: (the one you set in `.env`)
- **Remember me**: ✓ (optional, keeps you logged in for 30 days)

### 3. Test the API

After logging in, you can test the API:

```bash
# Get current user info
curl http://localhost:8080/api/auth/me \
  -H "Cookie: accessToken=..." \
  --cookie-jar cookies.txt

# Or in your browser console:
fetch('/api/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

## Common API Endpoints

### Authentication

```javascript
// Login
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username: 'admin',
    password: 'your_password',
    rememberMe: false
  })
})

// Logout
fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
})

// Get current user
fetch('/api/auth/me', {
  credentials: 'include'
})

// Change password
fetch('/api/auth/change-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    currentPassword: 'old_pass',
    newPassword: 'new_pass'
  })
})
```

### User Management (Admin Only)

```javascript
// Get all users
fetch('/api/users', { credentials: 'include' })

// Create new user
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username: 'john.doe',
    password: 'SecurePass123',
    full_name: 'John Doe',
    roleIds: [2] // User role
  })
})

// Update user
fetch('/api/users/2', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    full_name: 'John Smith',
    is_active: true
  })
})

// Admin change user password
fetch('/api/users/2/password', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    newPassword: 'NewSecurePass123'
  })
})

// Assign roles
fetch('/api/users/2/roles', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    roleIds: [1, 2] // Admin and User roles
  })
})
```

### Role Management

```javascript
// Get all roles
fetch('/api/users/roles/all', { credentials: 'include' })

// Get all permissions
fetch('/api/users/permissions/all', { credentials: 'include' })

// Create custom role (admin only)
fetch('/api/users/roles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'developer',
    description: 'Developer with limited access',
    permissionIds: [13, 14, 15, 16] // Select appropriate permissions
  })
})
```

## Roles and Permissions

### Admin Role
✅ Full access to everything
✅ User management (create, edit, delete users)
✅ Role management (create, edit, delete roles)
✅ Assign roles to users
✅ Change any user's password
✅ View audit logs

### User Role
✅ Access all application features
✅ View and manipulate data
✅ Change own password
❌ Cannot manage users
❌ Cannot manage roles
❌ Cannot assign roles

## Security Features

- ✅ **Password Hashing**: bcrypt with 10 salt rounds
- ✅ **Session Timeout**: 60 minutes of inactivity
- ✅ **Maximum Session**: 24 hours
- ✅ **Account Lockout**: 5 failed attempts = 15 minute lockout
- ✅ **Audit Logging**: All role changes tracked
- ✅ **HTTP-Only Cookies**: Tokens not accessible to JavaScript
- ✅ **Rate Limiting**: Sensitive endpoints protected

## Next Steps

### Immediate Actions

1. **Change Admin Password**
   - Login as admin
   - Use the change password endpoint
   - Or update via API

2. **Create Additional Users**
   - Use the user creation API
   - Assign appropriate roles
   - Test their access

3. **Update Existing Frontend**
   - Add authentication checks to your pages
   - Redirect to login if not authenticated
   - Show/hide features based on role

### Frontend Integration

Update your existing pages to check authentication:

```html
<script>
  // Check if user is authenticated
  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        // Not authenticated, redirect to login
        window.location.href = '/login.html';
        return;
      }
      
      const data = await response.json();
      const user = data.user;
      
      // Show/hide admin features
      if (user.roles.some(r => r.name === 'admin')) {
        document.getElementById('adminFeatures').style.display = 'block';
      }
      
      // Display user info
      document.getElementById('userName').textContent = user.full_name;
      
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/login.html';
    }
  }
  
  // Run on page load
  checkAuth();
</script>
```

### Building User Management UI

You can build a user management interface using the provided APIs. Key features to implement:

1. **User List Page**
   - Display all users
   - Show roles for each user
   - Edit/delete buttons

2. **Create User Form**
   - Username input
   - Password input (with strength indicator)
   - Full name input
   - Role selection (multi-select)

3. **Edit User Form**
   - Update full name
   - Activate/deactivate account
   - Reassign roles

4. **Role Management Page**
   - List roles
   - Create custom roles
   - Assign permissions to roles

## Troubleshooting

### "Authentication failed" on all requests

**Check:**
- Are you logged in? Visit `/login.html`
- Is the cookie being sent? Check browser dev tools
- Has your session expired? Login again

### "Admin role not found" during setup

**Solution:**
```bash
# Re-run the database migration
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql
```

### Cannot login with admin credentials

**Check:**
1. Is `DEFAULT_ADMIN_PASSWORD` set in `.env`?
2. Did you run `node setup-admin-user.js`?
3. Try resetting the password in the database

### Session keeps expiring

**Reason**: 60-minute inactivity timeout
**Solution**: 
- Use "Remember me" for longer sessions
- Activity updates automatically on each request
- Implement refresh token flow in frontend

## File Locations

### Backend Files
- **Types**: `src/types/auth.types.ts`
- **Repositories**: `src/repositories/UserRepository.ts`, `RoleRepository.ts`, `AuthRepository.ts`
- **Services**: `src/services/AuthService.ts`, `UserService.ts`
- **Middleware**: `src/middleware/auth.ts`
- **Routes**: `src/routes/auth.routes.ts`, `user.routes.ts`
- **Main App**: `src/app.ts`

### Database
- **Migration**: `database/init-scripts/07-auth-system.sql`
- **Setup Script**: `setup-admin-user.js`

### Frontend
- **Login Page**: `public/login.html`

### Documentation
- **Setup Guide**: `Technical Documentation/01-Getting-Started/Authentication-Setup-Guide.md`
- **Implementation Summary**: `AUTHENTICATION-IMPLEMENTATION-SUMMARY.md`

## Support

For detailed information, refer to:
- **Full Setup Guide**: `Technical Documentation/01-Getting-Started/Authentication-Setup-Guide.md`
- **Implementation Details**: `AUTHENTICATION-IMPLEMENTATION-SUMMARY.md`
- **API Examples**: See the "API Endpoints" section in the Setup Guide

## Summary

✅ **Backend**: Complete and production-ready
✅ **Security**: Industry-standard practices implemented
✅ **API**: Fully functional with comprehensive endpoints
✅ **Documentation**: Complete with examples
✅ **Basic UI**: Simple login page included

**You're ready to go!** Login with your admin credentials and start using the authenticated system.

**Recommended Next Step**: Build user management UI pages to make it easier to create and manage users through a web interface rather than API calls.

Good luck with your deployment assistant application! 🚀

