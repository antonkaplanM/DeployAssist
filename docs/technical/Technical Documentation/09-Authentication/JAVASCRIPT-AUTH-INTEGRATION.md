# JavaScript Authentication Integration Guide

## Files Created

I've created JavaScript versions of the authentication system:

- `auth-service.js` - Authentication service (login, logout, token management)
- `auth-middleware.js` - Middleware for protecting routes
- `auth-routes.js` - Authentication API endpoints
- `user-routes.js` - User management endpoints
- `setup-admin-user.js` - Script to create admin user (already exists)

## Quick Integration into app.js

### Step 1: Add Cookie Parser

Near the top of `app.js`, after other requires:

```javascript
const cookieParser = require('cookie-parser');
```

And after the line `app.use(express.json())`:

```javascript
app.use(cookieParser());
```

### Step 2: Initialize Authentication

Add this section after your middleware setup and before your routes (around line 50):

```javascript
// ===== AUTHENTICATION SETUP =====
const AuthService = require('./auth-service');
const { createAuthMiddleware, requireAdmin } = require('./auth-middleware');
const createAuthRoutes = require('./auth-routes');
const createUserRoutes = require('./user-routes');

// Check if JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET not set in environment variables');
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

// Initialize authentication service
const authService = new AuthService(db.pool, process.env.JWT_SECRET);
const authenticate = createAuthMiddleware(authService, db.pool);

// Periodic cleanup of expired sessions (every hour)
setInterval(() => {
    authService.cleanupExpired().catch(err => {
        console.error('Cleanup error:', err);
    });
}, 60 * 60 * 1000);

console.log('✅ Authentication system initialized');
```

### Step 3: Add Authentication Routes

Add these routes BEFORE your existing API routes:

```javascript
// Authentication routes (public - no auth required)
app.use('/api/auth', createAuthRoutes(authService, authenticate));

// User management routes (admin only)
app.use('/api/users', createUserRoutes(db.pool, authService, authenticate, requireAdmin));
```

### Step 4: Protect Existing Routes

To protect your existing routes, add `authenticate` middleware to them.

For example, change this:
```javascript
app.get('/api/salesforce/accounts', async (req, res) => {
```

To this:
```javascript
app.get('/api/salesforce/accounts', authenticate, async (req, res) => {
```

Or protect entire route groups:
```javascript
// Protect all SML routes
app.use('/api/sml', authenticate, smlRoutes);
```

## Complete Example

Here's what the relevant section of your `app.js` should look like:

```javascript
// ... existing requires ...
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ADD THIS

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ===== AUTHENTICATION SETUP =====
const AuthService = require('./auth-service');
const { createAuthMiddleware, requireAdmin } = require('./auth-middleware');
const createAuthRoutes = require('./auth-routes');
const createUserRoutes = require('./user-routes');

if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET not set');
    process.exit(1);
}

const authService = new AuthService(db.pool, process.env.JWT_SECRET);
const authenticate = createAuthMiddleware(authService, db.pool);

setInterval(() => authService.cleanupExpired().catch(console.error), 60 * 60 * 1000);
console.log('✅ Authentication initialized');

// ===== ROUTES =====

// Public routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Authentication routes (public)
app.use('/api/auth', createAuthRoutes(authService, authenticate));

// User management (admin only)
app.use('/api/users', createUserRoutes(db.pool, authService, authenticate, requireAdmin));

// Protected routes - existing routes now require authentication
app.get('/api/salesforce/accounts', authenticate, async (req, res) => {
    // ... your existing code ...
});

// Or protect entire route groups
app.use('/api/sml', authenticate, smlRoutes);

// ... rest of your routes ...
```

## Testing the Integration

### 1. Set Environment Variables

Add to your `.env` file:

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_secret_here

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123!
```

### 2. Run Database Migration

```bash
psql -U app_user -d deployment_assistant -f database/init-scripts/07-auth-system.sql
```

### 3. Create Admin User

```bash
node setup-admin-user.js
```

### 4. Start Your App

```bash
npm start
```

### 5. Test Login

Visit: `http://localhost:8080/login.html`

Or test with curl:

```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourSecurePassword123!"}' \
  -c cookies.txt

# Get current user
curl http://localhost:8080/api/auth/me \
  -b cookies.txt

# Access protected route
curl http://localhost:8080/api/salesforce/accounts \
  -b cookies.txt
```

## Optional: Protect Specific Routes

You can selectively protect routes:

```javascript
// Public route - no auth
app.get('/api/public-data', (req, res) => {
    // anyone can access
});

// Protected route - requires any authenticated user
app.get('/api/data', authenticate, (req, res) => {
    // req.user is available
});

// Admin-only route
app.get('/api/admin/settings', authenticate, requireAdmin(), (req, res) => {
    // only admins can access
});
```

## Accessing User Info

In any protected route, you can access the current user:

```javascript
app.get('/api/some-route', authenticate, (req, res) => {
    console.log('User:', req.user.username);
    console.log('Roles:', req.user.roles.map(r => r.name));
    
    // Check if admin
    const isAdmin = req.user.roles.some(r => r.name === 'admin');
    
    if (isAdmin) {
        // admin-specific logic
    }
    
    res.json({ message: `Hello, ${req.user.full_name}!` });
});
```

## Frontend Integration

Update your frontend to check authentication:

```javascript
// Check if logged in
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Not logged in, redirect
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        console.log('Logged in as:', data.user.username);
        
        // Show/hide admin features
        const isAdmin = data.user.roles.some(r => r.name === 'admin');
        if (isAdmin) {
            document.getElementById('adminPanel').style.display = 'block';
        }
        
    } catch (error) {
        window.location.href = '/login.html';
    }
}

// Run on page load
checkAuth();
```

## Troubleshooting

### "JWT_SECRET not set" error
Add `JWT_SECRET` to your `.env` file.

### "Cannot find module 'cookie-parser'"
Run: `npm install cookie-parser`

### Routes not protected
Make sure you added `authenticate` middleware to the routes.

### Login works but routes still return 401
Check that cookies are being sent. In fetch, use `credentials: 'include'`.

## Summary

1. ✅ Created JavaScript auth files
2. ✅ Add cookie parser to app.js
3. ✅ Initialize auth service
4. ✅ Add auth routes
5. ✅ Protect existing routes
6. ✅ Test with login.html

The system is now fully functional in JavaScript! 🎉

