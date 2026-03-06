# EPIC-01: Infrastructure & Foundation

## Epic Description

Establish the core platform infrastructure required to support the Deployment Assistant application. This includes the Node.js/Express backend server, PostgreSQL database, authentication and authorization system, frontend scaffold with routing and layout, shared middleware, utilities, and the development toolchain.

**Business Value:** Provides the foundational runtime, security, and developer experience upon which all feature epics depend. Without this infrastructure, no user-facing functionality can be delivered.

**Dependencies:** None (this is the root epic).

---

## Tasks

### T-01.01 — Initialize Node.js Project and Express Server

**Description:** Create the Node.js project with `package.json`, install core dependencies, and set up the Express server entry point (`app.js`) with basic middleware.

**Acceptance Criteria:**
- `package.json` with project metadata and scripts (`start`, `dev:backend`, `dev:frontend`, `build`, `test`)
- Express server starts on configurable port (default 5000)
- `dotenv` loads environment variables from `.env`
- JSON body parsing (`express.json()`) and URL-encoded body parsing enabled
- Cookie parser middleware installed and configured
- CORS middleware configured with whitelist of allowed origins and credentials support
- Health check endpoint at `GET /health` returns `{ status: 'ok' }`
- Graceful shutdown on `SIGTERM`/`SIGINT`

**Technical Details:**
- Core dependencies: `express`, `dotenv`, `cookie-parser`, `cors`
- Dev dependencies: `nodemon` for hot reload
- npm scripts: `start` (production), `dev:backend` (nodemon)

---

### T-01.02 — Set Up PostgreSQL Database Connection Layer

**Description:** Create the database connection module (`database.js`) that manages a PostgreSQL connection pool and exposes query helpers.

**Acceptance Criteria:**
- PostgreSQL connection pool created via `pg.Pool`
- Configuration from environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Pool tuning parameters: `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_CONNECTION_TIMEOUT`
- Optional `DATABASE_URL` connection string support
- Optional `DATABASE_SSL` for SSL connections
- Exported functions: `query(text, params)`, `getClient()`, `transaction(callback)`, `testConnection()`, `closePool()`, `getPoolStats()`
- Database health check endpoint at `GET /api/health/database` returns pool statistics and connectivity status

**Technical Details:**
- Dependencies: `pg`, `pg-pool`
- Database name: `deployment_assistant`
- Pool events logged (connect, error, remove)

---

### T-01.03 — Create Database Initialization Scripts

**Description:** Write SQL initialization scripts that create all required tables, indexes, and seed data for the application.

**Acceptance Criteria:**
- Scripts stored in `database/init-scripts/` directory
- Auth tables created: `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `pages`, `role_pages`, `refresh_tokens`, `session_activity`, `auth_audit_log`, `user_settings`
- Provisioning tables created: `expiration_monitor`, `expiration_analysis_log`, `all_accounts`, `ghost_accounts`, `packages`, `package_change_analysis`, `package_change_analysis_log`, `sml_tenant_data`, `sml_ghost_accounts`, `ps_audit_trail`, `ps_audit_log`, `async_validation_results`, `async_validation_processing_log`
- Product tables created: `products`, `product_sync_log`, `package_product_mapping`, `product_bundles`, `bundle_products`, `product_update_options`, `product_update_requests`, `product_update_request_history`, `current_accounts`, `current_accounts_sync_log`
- Reporting tables created: `custom_reports`
- Observability tables created: `mcp_tool_invocations`
- Seed data: default admin role, default pages, default permissions
- Scripts are idempotent (can be re-run safely)

**Key Detail:**
- Auth script file: `07-auth-system.sql` creates `roles`, `users`, `user_roles`, `permissions`, `role_permissions`, `auth_audit_log`, `refresh_tokens`, `session_activity`
- Page entitlements script file: `08-page-entitlements.sql` creates `pages`, `role_pages`
- User settings script file: `add-user-settings.sql` creates `user_settings` with columns `id`, `user_id`, `setting_key`, `setting_value` (text), `is_encrypted` (boolean), `created_at`, `updated_at`, and a UNIQUE constraint on `(user_id, setting_key)`
- Seed roles: `admin` (full access, system role), `user` (standard access, system role)
- Seed permissions (resource.action format): `users.create`, `users.read`, `users.update`, `users.delete`, `users.manage`, `roles.create`, `roles.read`, `roles.update`, `roles.delete`, `roles.assign`, `roles.manage`, `expiration_monitor.read`, `expiration_monitor.write`, `packages.read`, `packages.write`, `ghost_accounts.read`, `ghost_accounts.write`, `salesforce.access`, `salesforce.service_account`, `sml.access`
- Seed pages (top-level): `dashboard`, `analytics`, `provisioning`, `customer_products`, `roadmap`, `help`, `settings`, `user_management`
- Seed pages (analytics children): `analytics.overview`, `analytics.account_history`, `analytics.package_changes`
- Seed pages (provisioning children): `provisioning.monitor`, `provisioning.expiration`, `provisioning.ghost_accounts`, `provisioning.audit_trail`
- Pages table schema includes: `id`, `name` (UNIQUE), `display_name`, `description`, `parent_page_id`, `route`, `icon`, `sort_order`, `is_system_page`, `created_at`, `updated_at`

---

### T-01.04 — Implement Authentication Service

**Description:** Build the authentication service that handles user login, JWT token generation and verification, session management, and password hashing.

**Acceptance Criteria:**
- `AuthService` class with methods: `login()`, `logout()`, `verifyToken()`, `refreshToken()`, `changePassword()`
- Passwords hashed with `bcryptjs` (configurable rounds via `BCRYPT_ROUNDS`)
- JWT access tokens signed with `JWT_SECRET` (required environment variable)
- Refresh tokens stored in `refresh_tokens` table
- Sessions tracked in `session_activity` table
- Account lockout after configurable failed login attempts
- Auth audit logging to `auth_audit_log` table
- Hourly cleanup of expired sessions (background interval)

**Technical Details:**
- Dependencies: `jsonwebtoken`, `bcryptjs`
- Token lifetime: configurable (default 1 year for access, 30 days for refresh)
- Tokens stored as HTTP-only, secure cookies

**Key Detail:**
- JWT token payload structure: `{ userId, username, roles, permissions, pages, sessionId, type: 'access', iat, exp }`
- Token is extracted from `req.cookies.accessToken` or `Authorization: Bearer <token>` header
- Login response sets HTTP-only cookies and returns: `{ success, message, user: { id, username, full_name, roles, last_login_at } }`
- Failed login error codes: `INVALID_CREDENTIALS`, `USER_LOCKED`, `LOGIN_ERROR`

---

### T-01.05 — Implement Authentication Middleware

**Description:** Create Express middleware functions for authentication and authorization that protect API routes.

**Acceptance Criteria:**
- `authenticate` middleware: extracts JWT from cookies or `Authorization` header, verifies token, loads user with roles/pages/permissions into `req.user`
- `requireAdmin()` middleware: rejects non-admin users with 403
- `requireRole(roleName)` middleware: checks if user has specified role
- `requirePermission(permissionName)` middleware: checks if user has specified permission
- `requirePageAccess(pageName)` middleware: checks if user's role grants access to the page
- `loadPermissions()` middleware: loads full permissions list into `req.permissions`
- `withSalesforceConnection()` middleware: resolves Salesforce connection from user or service account
- Middleware returns standardized error responses (401, 403)

**Key Detail:**
- Middleware is created via factory function: `createAuthMiddleware(authService, pool)` returns the `authenticate` middleware
- `requirePermission(resource, action)` takes two arguments (resource string and action string), not a single permission name
- `loadPermissions(pool)` requires the database pool as argument and populates `req.user.permissions`
- `requirePageAccess(pageName, pool)` requires both the page name and database pool
- `withSalesforceConnection(pool)` resolves the Salesforce connection (per-user or service account) and attaches it to the request

---

### T-01.06 — Implement Auth API Routes

**Description:** Create the authentication API routes for login, logout, token refresh, and user info.

**Acceptance Criteria:**
- `POST /api/auth/login` — accepts `username`, `password`, optional `rememberMe`; sets HTTP-only cookies; returns user info
- `POST /api/auth/logout` — clears cookies, invalidates session
- `GET /api/auth/me` — returns current authenticated user with roles and pages
- `POST /api/auth/change-password` — accepts `currentPassword`, `newPassword`; validates current password
- All endpoints return standardized JSON responses
- Login endpoint rate-limited

**Key Detail:**
- Login request body: `{ username, password, rememberMe? }`
- Login response: `{ success: true, message: 'Login successful', user: { id, username, full_name, roles, last_login_at } }`
- Me response: `{ success: true, user: { id, username, full_name, is_active, last_login_at, created_at, roles } }`
- Change password request body: `{ currentPassword, newPassword }`
- Logout response: `{ success: true, message: 'Logged out successfully' }`

---

### T-01.07 — Set Up Error Handling Framework

**Description:** Create a centralized error handling framework with custom error classes, async handler wrapper, and global error middleware.

**Acceptance Criteria:**
- `ApiError` class with `statusCode`, `message`, `code` properties
- Pre-defined error types: `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`
- `asyncHandler(fn)` wrapper that catches async errors and forwards to error middleware
- Global error middleware that logs errors (Winston) and returns standardized error JSON
- Response helper utilities: `sendSuccess()`, `sendError()`, `sendPaginated()`

**Technical Details:**
- Dependencies: `winston` (logging)
- Logger configuration: console + file transports, configurable log level via `LOG_LEVEL`

**Key Detail:**
- Full error class hierarchy in `middleware/error-handler.js`: `ApiError` (base), `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ValidationError` (422), `TooManyRequestsError` (429), `InternalServerError` (500), `ServiceUnavailableError` (503)
- Additional error classes in `utils/errors.js`: `AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `BadRequestError`, `RateLimitError`, `TimeoutError`, `InternalServerError`, `ServiceUnavailableError`, `DatabaseError`, `ExternalAPIError`

---

### T-01.08 — Set Up Rate Limiting

**Description:** Configure rate limiting middleware to prevent abuse of API endpoints.

**Acceptance Criteria:**
- Global rate limiter applied to all `/api/` routes
- Configurable window (`RATE_LIMIT_WINDOW`, default 15 minutes) and max requests (`RATE_LIMIT_MAX`, default 100)
- Rate limit headers included in responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- Custom rate limit exceeded response (429 status)

**Technical Details:**
- Dependency: `express-rate-limit`

---

### T-01.09 — Initialize React Frontend with Vite

**Description:** Set up the React frontend application using Vite as the build tool, with Tailwind CSS for styling.

**Acceptance Criteria:**
- `frontend/` directory with its own `package.json`
- React 19 with React Router 7 for client-side routing
- Vite configured with React plugin
- Tailwind CSS installed and configured with `tailwind.config.js`
- Dev server on port 8080 with proxy for `/api` and `/auth` to backend on port 5000
- Production build outputs to `frontend/dist/`
- npm scripts: `dev` (Vite dev server), `build` (production build), `preview`
- Custom `index.css` with base Tailwind directives and custom scrollbar styles

**Technical Details:**
- Dependencies: `react`, `react-dom`, `react-router-dom`, `axios`
- Dev dependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`

---

### T-01.10 — Create Frontend Layout Components

**Description:** Build the shell layout components that frame every authenticated page: MainLayout, Sidebar, and Header.

**Acceptance Criteria:**
- `MainLayout` component: flex container with collapsible Sidebar, Header, and scrollable main content area (`Outlet`)
- `Sidebar` component: collapsible navigation with sections (Analytics, Provisioning, Customer Products, Custom Reports, Experimental); items filtered by `hasPageAccess(pageName)`; active route highlighting; dynamic Custom Reports section that loads saved reports
- `Header` component: displays user greeting (from `AuthContext`), Logout button
- Responsive design using Tailwind CSS
- Dark mode support via `dark:` utility classes

**Key Detail:**
- Exact sidebar navigation structure and page-name mappings:
  - `Dashboard` — path: `/`, page: `dashboard`
  - `Analytics` (parent) — page: `analytics`
    - `Overview` — path: `/analytics`, page: `analytics.overview`
    - `Account History` — path: `/analytics/account-history`, page: `analytics.account_history`
    - `Package Changes` — path: `/analytics/package-changes`, page: `analytics.package_changes`
    - `Current Accounts` — path: `/analytics/current-accounts`, page: `analytics.current_accounts`
  - `Provisioning Monitor` (parent) — page: `provisioning`
    - `Provisioning Monitor` — path: `/provisioning`, page: `provisioning.monitor`
    - `Expiration Monitor` — path: `/provisioning/expiration`, page: `provisioning.expiration`
    - `Ghost Accounts` — path: `/provisioning/ghost-accounts`, page: `provisioning.ghost_accounts`
    - `Audit Trail` — path: `/provisioning/audit-trail`, page: `provisioning.audit_trail`
  - `Customer Products` (parent) — page: `customer_products`
    - `Product Entitlements` — path: `/customer-products`, page: `customer_products`
    - `Pending Requests` — path: `/pending-product-requests`, page: `customer_products`
  - `Custom Reports` (dynamic) — page: `custom_reports`
    - `Create Report` — static link, always visible if `custom_reports.create` access
    - Saved reports — dynamically loaded from `GET /api/custom-reports`, each links to `/custom-reports/:slug`
  - `Experimental Pages` (parent) — page: `experimental`
    - `Roadmap` — path: `/experimental/roadmap`, page: `experimental.roadmap`
    - `Product Catalogue` — path: `/experimental/product-catalogue`, page: `experimental.product-catalogue`
    - `Staging` — path: `/experimental/staging`, page: `experimental.staging`
  - `User Management` — path: `/users`, page: `user_management`
  - `Help` — path: `/help`, page: `help`
  - `Settings` — path: `/settings`, page: `settings`
- Custom Reports section has `dynamic: true` flag; saved reports are fetched with `listReports(100, 0)` when user has `custom_reports.view` access; list re-fetches when path starts with `/custom-reports`
- Saved report display name: `report.report_config?.title || report.name`

---

### T-01.11 — Implement Frontend Context Providers

**Description:** Create React context providers that manage global application state.

**Acceptance Criteria:**
- `AuthContext` / `AuthProvider`: manages `user`, `userPages`, provides `login()`, `logout()`, `hasPageAccess()`, `getAccessiblePages()`; calls `GET /api/auth/me` and `GET /api/users/me/pages` on mount
- `ThemeContext` / `ThemeProvider`: manages dark/light theme; persists preference in `localStorage`; provides `theme`, `toggleTheme()`, `isDark`
- `ToastContext` / `ToastProvider`: manages toast notification queue; provides `showToast({ message, type })`, `removeToast()`, `clearAllToasts()`
- `AutoRefreshContext` / `AutoRefreshProvider`: manages per-page auto-refresh intervals; provides `registerRefreshCallback()`, `updateAutoRefreshInterval()`; stores settings in `localStorage`
- All providers wrap the application in `App.jsx`

**Key Detail:**
- ThemeContext localStorage key: `theme`; values: `light`, `dark`; default: `light`
- AutoRefreshContext localStorage key: `autoRefreshInterval`; values (minutes): `0` (Never), `1`, `5`, `10`, `15`, `30`; default: `5`
- Auto-refresh affected pages: `dashboard`, `analytics`, `account-history`, `package-changes`, `provisioning`, `expiration`, `ghost-accounts`, `customer-products`, `ps-audit-trail`
- Additional localStorage keys used by settings: `defaultAnalyticsTimeframe`, `defaultExpirationTimeframe`, `defaultPackageChangesTimeframe`, `defaultDashboardValidationTimeframe`, `defaultDashboardRemovalsTimeframe`, `defaultDashboardExpirationWindow`

---

### T-01.12 — Implement Frontend Route Protection

**Description:** Create the `ProtectedRoute` component and configure all application routes with permission guards.

**Acceptance Criteria:**
- `ProtectedRoute` component: checks `hasPageAccess(pageName)` from `AuthContext`; redirects to login if not authenticated; shows "Access Denied" if authenticated but lacking permission
- Route definitions in `App.jsx` with all protected routes inside `MainLayout`
- Public routes (`/login`, `/api-test`) accessible without authentication
- Route-to-page-name mapping for all application pages

---

### T-01.13 — Create Common UI Components

**Description:** Build reusable UI components used across multiple pages.

**Acceptance Criteria:**
- `ErrorBoundary`: catches React render errors, displays fallback UI with error message and retry button
- `LoadingSpinner`: configurable size spinner with optional label
- `Toast`: toast notification component with success/error/warning/info variants, auto-dismiss, and manual close
- `TypeAheadSearch`: debounced search input with dropdown suggestions
- `ActionsMenu`: dropdown menu for row-level actions in tables
- `NestedMultiSelect`: hierarchical multi-select checkbox component for filter panels
- All components styled with Tailwind CSS and support dark mode

---

### T-01.14 — Set Up Frontend API Service Layer

**Description:** Create the base API client and pattern for frontend service modules.

**Acceptance Criteria:**
- `api.js`: Axios instance with `baseURL: '/api'`, `withCredentials: true`, response interceptor that redirects to `/login` on 401
- Service module pattern established: each domain gets a service file that exports functions calling the API client
- `authService.js`: `login()`, `logout()`, `getCurrentUser()`, `getUserPages()`
- Error handling pattern: services throw on non-2xx responses with meaningful messages

---

### T-01.15 — Implement Login Page

**Description:** Build the Login page where users authenticate.

**Acceptance Criteria:**
- Username and password form fields with validation
- "Remember Me" checkbox for extended session
- Submit calls `authService.login()`, stores user in `AuthContext`, redirects to `/`
- Error display for invalid credentials or locked accounts
- Loading state during authentication
- Styled consistently with application theme (Tailwind, dark mode support)

---

### T-01.16 — Configure Static File Serving for Production

**Description:** Configure Express to serve the built frontend static files in production mode.

**Acceptance Criteria:**
- Express serves files from `public/` (or `frontend/dist/`) directory
- SPA fallback: all non-API routes serve `index.html` for client-side routing
- Proper cache headers for static assets
- Works alongside API routes without conflicts

---

### T-01.17 — Set Up Environment Configuration

**Description:** Create the centralized environment configuration module and `.env` template.

**Acceptance Criteria:**
- `config/environment.js` exports all environment-derived configuration with defaults
- `.env.example` template file listing all environment variables with descriptions (no actual secrets)
- Variables grouped by category: App, Database, Auth, Salesforce, SML, Atlassian, Microsoft, LLM, MCP, Feature Flags
- Feature flags: `ENABLE_SML`, `ENABLE_JIRA`, `ENABLE_AUDIT_TRAIL`, `ENABLE_EXPIRATION_MONITOR`, `ENABLE_REPORT_AI`

---

### T-01.18 — Set Up Logging Infrastructure

**Description:** Configure structured logging using Winston for the backend.

**Acceptance Criteria:**
- Winston logger configured with console and file transports
- Log levels: `error`, `warn`, `info`, `http`, `debug`
- Configurable log level via `LOG_LEVEL` environment variable
- Structured JSON format for file logs
- Colorized format for console logs
- Logger exported as singleton for use across the application

---

### T-01.19 — Set Up Testing Infrastructure

**Description:** Configure testing frameworks for both backend and frontend.

**Acceptance Criteria:**
- Backend: Jest configured for unit and integration tests
- Frontend: Vitest configured with `@testing-library/react` and `jsdom` environment
- E2E: Playwright configured for end-to-end browser tests
- npm scripts: `test` (unit), `test:e2e` (Playwright)
- Test directory structure established

---

### T-01.20 — Implement Encryption Utilities

**Description:** Create encryption utility for securely storing sensitive credentials (Salesforce tokens, LLM API keys).

**Acceptance Criteria:**
- AES-256-GCM encryption/decryption functions
- Key derived from `JWT_SECRET` or dedicated encryption key
- Functions: `encrypt(plaintext)` → encrypted string, `decrypt(ciphertext)` → plaintext
- Used for storing user-specific API keys in `user_settings` table

---

## User Stories

### US-01.01 — User Can Log In to the Application

**As a** deployment team member, **I want to** log in with my username and password **so that** I can access the tools and data relevant to my role.

**Acceptance Criteria:**
- Login page is the default view for unauthenticated users
- Successful login redirects to the Dashboard
- Failed login displays a clear error message
- Account is locked after 5 consecutive failed attempts
- "Remember Me" option extends session duration

**Dependencies:** T-01.04, T-01.06, T-01.15

---

### US-01.02 — User Sees Only Authorized Pages in Navigation

**As a** user with a specific role, **I want to** see only the pages I have access to in the sidebar **so that** I am not confused by features I cannot use.

**Acceptance Criteria:**
- Sidebar renders navigation items based on the user's role-assigned pages
- Attempting to navigate directly to an unauthorized URL shows "Access Denied"
- Role changes take effect on next login

**Key Detail:**
- The full list of page names used for access control: `dashboard`, `analytics`, `analytics.overview`, `analytics.account_history`, `analytics.package_changes`, `analytics.current_accounts`, `provisioning`, `provisioning.monitor`, `provisioning.expiration`, `provisioning.ghost_accounts`, `provisioning.audit_trail`, `customer_products`, `custom_reports`, `experimental`, `experimental.roadmap`, `experimental.product-catalogue`, `experimental.staging`, `user_management`, `help`, `settings`
- Parent pages (e.g., `analytics`) control visibility of the entire section; child pages (e.g., `analytics.overview`) control individual sub-items
- `admin` role gets access to all pages; `user` role gets access to standard pages

**Dependencies:** T-01.05, T-01.10, T-01.12

---

### US-01.03 — User Can Switch Between Dark and Light Mode

**As a** user, **I want to** toggle between dark and light themes **so that** I can use the application comfortably in different lighting conditions.

**Acceptance Criteria:**
- Theme toggle available in the UI
- Theme preference persists across sessions (stored in localStorage)
- All pages and components render correctly in both themes

**Key Detail:**
- Theme options: `light` and `dark` (no "System/Auto" option)
- localStorage key: `theme`; default: `light`
- Dark mode applied via Tailwind CSS `dark:` utility classes; toggled by adding/removing `dark` class on `document.documentElement`

**Dependencies:** T-01.11

---

### US-01.04 — User Receives Toast Notifications for Actions

**As a** user, **I want to** see brief notification messages when actions succeed or fail **so that** I have confidence my actions were processed.

**Acceptance Criteria:**
- Success, error, warning, and info toast types with distinct styling
- Toasts auto-dismiss after a configurable duration
- Toasts can be manually dismissed
- Multiple toasts stack without overlapping content

**Dependencies:** T-01.11, T-01.13

---

### US-01.05 — User Can Log Out

**As a** user, **I want to** log out of the application **so that** my session is securely terminated.

**Acceptance Criteria:**
- Logout button in the Header
- Clicking logout clears session, cookies, and redirects to Login
- Subsequent API calls return 401 until re-authentication

**Dependencies:** T-01.04, T-01.06, T-01.10
