# Authentication System Setup Guide

## Overview

This guide explains how to set up and use the authentication and user management system.

## Features

- **JWT-based Authentication**: Secure token-based authentication using JSON Web Tokens
- **Session Management**: 24-hour session lifetime with 60-minute inactivity timeout
- **Remember Me**: Optional 30-day refresh token for persistent sessions
- **Role-Based Access Control (RBAC)**: Admin and User roles with extensible permission system
- **Password Security**: bcrypt password hashing following industry best practices
- **Audit Logging**: Comprehensive logging of role changes and security events
- **Account Protection**: Failed login attempt tracking and automatic account lockout

## Prerequisites

1. PostgreSQL database set up and running
2. Node.js and npm installed
3. Dependencies installed (`npm install`)

## Initial Setup

### Step 1: Configure Environment Variables

Create or update your `.env` file with the following authentication configuration:

```bash
# Generate a secure JWT secret (run this command):
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

JWT_SECRET=your_generated_jwt_secret_here

# Default admin credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123!
DEFAULT_ADMIN_FULL_NAME=System Administrator
```

**Important Security Notes:**
- Use a strong, randomly generated JWT_SECRET (at least 64 characters)
- Choose a secure admin password (minimum 8 characters)
- Change the default admin password after first login
- Never commit the `.env` file to version control

### Step 2: Run Database Migrations

Execute the authentication system database migration:

```bash
# If using psql directly:
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql

# Or using your preferred database client
```

This creates the following tables:
- `users` - User accounts
- `roles` - Available roles
- `user_roles` - User-role assignments
- `permissions` - Granular permissions
- `role_permissions` - Role-permission mappings
- `auth_audit_log` - Security audit trail
- `refresh_tokens` - Refresh tokens for "remember me"
- `session_activity` - Active session tracking

### Step 3: Create Default Admin User

Run the setup script to create the default admin user:

```bash
node setup-admin-user.js
```

This script will:
- Check if the admin user already exists
- Create the admin user with credentials from environment variables
- Assign the admin role
- Log the creation in the audit log

Expected output:
```
🔧 Setting up default admin user...
🔐 Hashing password...
👤 Creating admin user "admin"...
   ✅ User created successfully (ID: 1)
🎭 Assigning admin role...
   ✅ Admin role assigned

✅ Default admin user setup complete!

📋 Admin User Details:
   Username: admin
   Full Name: System Administrator
   Role: admin
   Created: 2025-01-16T10:30:00.000Z

🔐 You can now log in with these credentials
   Remember to change the password after first login!
```

### Step 4: Build and Start the Application

For TypeScript version:
```bash
# Build TypeScript
npm run build

# Start the application
npm run start:ts
```

For JavaScript version (legacy):
```bash
npm start
```

The server should now be running with authentication enabled!

## User Roles

### Admin Role
- Full access to all application features
- Can create, update, and delete users
- Can create, update, and delete custom roles
- Can assign roles to users
- Can change any user's password
- Can access audit logs

### User Role
- Access to all application features (data viewing and manipulation)
- Cannot create or manage users
- Cannot create or manage roles
- Cannot assign roles
- Can only change their own password

## API Endpoints

### Authentication Endpoints (Public)

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password",
  "rememberMe": false
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "System Administrator",
    "roles": [{"id": 1, "name": "admin", "description": "..."}],
    "last_login_at": "2025-01-16T10:30:00.000Z"
  }
}
```

#### Logout
```http
POST /api/auth/logout
Cookie: accessToken=...
```

#### Get Current User
```http
GET /api/auth/me
Cookie: accessToken=...
```

#### Change Own Password
```http
POST /api/auth/change-password
Cookie: accessToken=...
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Cookie: refreshToken=...
```

### User Management Endpoints (Admin Only)

#### Get All Users
```http
GET /api/users
Cookie: accessToken=...
```

#### Create User
```http
POST /api/users
Cookie: accessToken=...
Content-Type: application/json

{
  "username": "john.doe",
  "password": "SecurePass123",
  "full_name": "John Doe",
  "roleIds": [2]
}
```

#### Update User
```http
PUT /api/users/:id
Cookie: accessToken=...
Content-Type: application/json

{
  "full_name": "John Smith",
  "is_active": true
}
```

#### Delete User
```http
DELETE /api/users/:id
Cookie: accessToken=...
```

#### Assign Roles
```http
PUT /api/users/:id/roles
Cookie: accessToken=...
Content-Type: application/json

{
  "roleIds": [1, 2]
}
```

#### Admin Change Password
```http
PUT /api/users/:id/password
Cookie: accessToken=...
Content-Type: application/json

{
  "newPassword": "NewSecurePass123"
}
```

### Role Management Endpoints

#### Get All Roles
```http
GET /api/users/roles/all
Cookie: accessToken=...
```

#### Get All Permissions
```http
GET /api/users/permissions/all
Cookie: accessToken=...
```

#### Create Role (Admin Only)
```http
POST /api/users/roles
Cookie: accessToken=...
Content-Type: application/json

{
  "name": "developer",
  "description": "Developer role with limited access",
  "permissionIds": [13, 14, 15, 16, 17, 18]
}
```

#### Get Audit Logs (Admin Only)
```http
GET /api/users/audit/role-changes?limit=50&offset=0
Cookie: accessToken=...
```

## Security Features

### Password Policy

The system enforces the following password requirements:
- Minimum 8 characters
- No additional complexity requirements (following Gmail's approach)
- Passwords are hashed using bcrypt with 10 salt rounds

### Session Management

- **Access Token Lifetime**: 24 hours
- **Inactivity Timeout**: 60 minutes
- **Refresh Token Lifetime**: 30 days (when "Remember Me" is enabled)
- Sessions are stored in the database and tracked for activity
- Expired sessions are automatically cleaned up every hour

### Account Protection

- **Failed Login Attempts**: Tracked per user
- **Account Lockout**: After 5 failed attempts
- **Lockout Duration**: 15 minutes
- Lockout is automatically cleared on successful login

### Audit Logging

All role changes are logged with the following information:
- User ID affected
- Action performed
- Old and new values
- Performer (who made the change)
- IP address
- User agent
- Timestamp

## Common Tasks

### Adding a New User

1. Log in as admin
2. Send POST request to `/api/users` with user details
3. Assign appropriate roles

### Changing User Roles

1. Log in as admin
2. Send PUT request to `/api/users/:id/roles` with new role IDs

### Resetting a User's Password

1. Log in as admin
2. Send PUT request to `/api/users/:id/password` with new password

### Creating Custom Roles

1. Log in as admin
2. Get available permissions: `GET /api/users/permissions/all`
3. Create role with selected permissions: `POST /api/users/roles`

### Deactivating a User

1. Log in as admin
2. Update user: `PUT /api/users/:id` with `{"is_active": false}`

## Troubleshooting

### "JWT_SECRET not set" Error

**Solution**: Add `JWT_SECRET` to your `.env` file with a secure random string.

### "Admin role not found" Error

**Solution**: Run the database migration script (07-auth-system.sql) first.

### "Authentication failed" on All Requests

**Possible causes**:
1. No access token in cookie
2. Token expired
3. Session inactive for more than 60 minutes
4. User account deactivated

**Solution**: Log in again to get a new token.

### "User account is locked"

**Solution**: Wait 15 minutes, or have an admin reset the user's failed login attempts in the database.

### Cannot Access Protected Routes

**Solution**: 
1. Verify you're logged in
2. Check that your role has the required permissions
3. For admin-only routes, ensure your account has the admin role

## Best Practices

1. **Change Default Passwords**: Always change the default admin password after initial setup
2. **Use Strong Passwords**: Enforce strong passwords for all users (minimum 8 characters)
3. **Regular Audits**: Periodically review audit logs for suspicious activity
4. **Principle of Least Privilege**: Assign users only the roles they need
5. **Secure JWT Secret**: Use a long, random string for JWT_SECRET and keep it secret
6. **HTTPS in Production**: Always use HTTPS in production to protect tokens in transit
7. **Regular Cleanup**: The system automatically cleans up expired sessions, but you can manually run cleanup if needed

## Next Steps

- Set up a login page in the frontend
- Implement role-based UI components
- Configure session timeout warnings
- Set up automated backups of user data and audit logs
- Consider implementing multi-factor authentication (MFA) for enhanced security

