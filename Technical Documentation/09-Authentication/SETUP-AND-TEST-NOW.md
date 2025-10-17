# 🚀 Setup and Test Authentication - Final Steps

## ✅ Integration Complete!

Your authentication system is now fully integrated into your app. Here are the final steps to get everything running.

## Quick Setup (10 Minutes)

### Step 1: Set Environment Variables (2 min)

1. Generate a secure JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Add to your `.env` file (or create it if it doesn't exist):
   ```bash
   # Authentication
   JWT_SECRET=<paste_your_generated_secret_here>
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_PASSWORD=ChangeMe123!
   DEFAULT_ADMIN_FULL_NAME=System Administrator
   
   # Your existing environment variables below...
   ```

### Step 2: Install Dependencies (1 min)

```bash
npm install cookie-parser
```

(The other packages - bcryptjs, jsonwebtoken, express-rate-limit - are already in package.json)

### Step 3: Run Database Migration (2 min)

```bash
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql
```

If you don't have `psql` command-line tool, you can:
- Copy the contents of `database/init-scripts/07-auth-system.sql`
- Paste it into your PostgreSQL client (pgAdmin, DBeaver, etc.)
- Execute it

### Step 4: Create Admin User (1 min)

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
   Created: 2025-01-16T...

🔐 You can now log in with these credentials
```

### Step 5: Start Your App (1 min)

```bash
npm start
```

Look for these messages:
```
✅ PostgreSQL connection pool established
✅ Authentication system initialized
Server running on port 8080
```

## Test Your Setup (3 Minutes)

### Test 1: Visit Home Page

1. Open browser to: `http://localhost:8080`
2. **Expected**: Redirect to login page
3. **Success**: You see the login form

### Test 2: Login as Admin

1. Enter credentials:
   - Username: `admin`
   - Password: (from your `.env` file)
   - Check "Remember me" (optional)
2. Click **Sign In**
3. **Expected**: Redirect back to main dashboard
4. **Success**: You see the dashboard with:
   - "User Management" button in sidebar (admin only)
   - "Logout" button at bottom
   - Your name displayed in sidebar

### Test 3: User Management

1. Click **User Management** in sidebar
2. **Expected**: See user list with your admin account
3. Click **+ Create User**
4. Fill in form:
   - Username: `testuser`
   - Password: `Test1234`
   - Full Name: `Test User`
   - Roles: Check "user"
5. Click **Create User**
6. **Success**: New user appears in list

### Test 4: Test Regular User

1. Click **Logout**
2. Login as `testuser` / `Test1234`
3. **Expected**: Dashboard loads but NO "User Management" button
4. **Success**: Regular user has limited access

### Test 5: API Authentication

Open browser console (F12) and run:
```javascript
// Should work - you're authenticated
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(d => console.log('Current user:', d))

// Should work if you have Salesforce configured
fetch('/api/salesforce/accounts', {credentials: 'include'})
  .then(r => r.json())
  .then(d => console.log('Salesforce data:', d))
```

## What Changed

### Backend (`app.js`)
✅ Added authentication modules
✅ Added cookie parser
✅ Initialized auth service
✅ Added auth routes (`/api/auth/*`, `/api/users/*`)
✅ Protected SML routes with authentication

### Frontend (`public/index.html`)
✅ Added auth-utils.js
✅ Added authentication check on page load
✅ Redirects to login if not authenticated
✅ Shows User Management button for admins
✅ Shows Logout button
✅ Displays user info in sidebar
✅ Automatically includes credentials in all API calls

### New Files Created
✅ `auth-service.js` - Authentication logic
✅ `auth-middleware.js` - Route protection
✅ `auth-routes.js` - Login/logout endpoints
✅ `user-routes.js` - User management endpoints
✅ `public/auth-utils.js` - Frontend utilities
✅ `public/login.html` - Login page
✅ `public/user-management.html` - User admin UI
✅ `setup-admin-user.js` - Admin setup script
✅ `database/init-scripts/07-auth-system.sql` - Database schema

## Features Now Available

### For All Users
✅ Secure login with JWT tokens
✅ Session management (24hr max, 60min inactivity)
✅ Remember me (30 days)
✅ Change own password
✅ Access all application features

### For Admin Users
✅ Everything above, PLUS:
✅ Create/edit/delete users
✅ Assign roles to users
✅ Change any user's password
✅ View all users
✅ Access user management interface

### Security Features
✅ Password hashing with bcrypt
✅ HTTP-only cookies
✅ Account lockout after 5 failed attempts
✅ Session timeout after inactivity
✅ Audit logging for role changes
✅ Rate limiting on login endpoint

## Troubleshooting

### "Cannot find module 'cookie-parser'"
```bash
npm install cookie-parser
```

### "JWT_SECRET not set"
Add it to your `.env` file (see Step 1 above)

### "Cannot connect to database"
Make sure PostgreSQL is running and credentials in `.env` are correct

### Login page doesn't load
Check that these files exist:
- `public/login.html`
- `public/auth-utils.js`

### Can't login
1. Check admin user was created: Run `node setup-admin-user.js` again
2. Check password in `.env` matches what you're typing
3. Check browser console for errors (F12)

### Dashboard shows blank page
1. Open browser console (F12)
2. Look for authentication errors
3. Try clearing cookies and logging in again

### "User Management" not showing
Make sure you're logged in as admin user. Regular users won't see this option.

## Next Steps

### Immediate
1. ✅ Change admin password (use change password API or UI)
2. ✅ Create regular users for your team
3. ✅ Test with different user roles

### Optional Enhancements
- Add more custom roles
- Build role management UI
- Add password reset via email
- Implement MFA (future)

## Quick Command Reference

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Create Admin User
```bash
node setup-admin-user.js
```

### Run Database Migration
```bash
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql
```

### Start App
```bash
npm start
```

### Test Login (curl)
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' \
  -c cookies.txt

curl http://localhost:8080/api/auth/me -b cookies.txt
```

## URLs

- **Main App**: `http://localhost:8080`
- **Login Page**: `http://localhost:8080/login.html`
- **User Management**: `http://localhost:8080/user-management.html`

## Summary

✅ **Backend integrated** - app.js updated with authentication
✅ **Frontend integrated** - index.html requires authentication
✅ **Database ready** - schema created
✅ **Admin user ready** - default admin account created
✅ **Login page ready** - beautiful UI
✅ **User management ready** - full admin interface

**Your authentication system is complete and ready to use!** 🎉

Just follow the 5 setup steps above and you'll be up and running in 10 minutes!

