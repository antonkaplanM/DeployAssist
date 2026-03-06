# EPIC-08: User Management

## Epic Description

Build the User Management page that allows administrators to create and manage user accounts, define roles, assign permissions, and control page-level access. This page provides the full RBAC (Role-Based Access Control) administration interface.

**Business Value:** User Management enables administrators to onboard team members, control what each user can see and do, and maintain security by following the principle of least privilege. Without this, all users would have identical access or user management would require direct database changes.

**Dependencies:** EPIC-01 (Infrastructure — auth service, RBAC tables, auth middleware)

---

## Tasks

### T-08.01 — Implement User Management API Routes

**Description:** Create the backend API routes for managing users, roles, permissions, and page entitlements.

**Acceptance Criteria:**
- **User CRUD:**
  - `GET /api/users` — list all users (admin only)
  - `POST /api/users` — create user (body: `username`, `password`, `full_name`, `roleIds`)
  - `GET /api/users/:id` — get user details
  - `PUT /api/users/:id` — update user (body: `full_name`, `is_active`)
  - `DELETE /api/users/:id` — deactivate/delete user
  - `PUT /api/users/:id/password` — admin reset user password
  - `PUT /api/users/:id/roles` — assign roles to user (body: `roleIds`)
- **Role management:**
  - `GET /api/users/roles/all` — list all roles
  - `POST /api/users/roles` — create role (body: `name`, `description`)
  - `DELETE /api/users/roles/:id` — delete role
- **Page entitlements:**
  - `GET /api/users/pages/all` — list all available pages
  - `GET /api/users/me/pages` — get current user's pages
  - `GET /api/users/roles/:id/pages` — get pages assigned to a role
  - `PUT /api/users/roles/:id/pages` — assign pages to a role (body: `pageIds`)
- **Permissions:**
  - `GET /api/users/permissions/all` — list all available permissions
  - `GET /api/users/roles/:id/permissions` — get permissions assigned to a role
  - `PUT /api/users/roles/:id/permissions` — assign permissions to a role (body: `permissionIds`)
- All routes require authentication; most require admin role

---

### T-08.02 — Implement User Service (Frontend)

**Description:** Create the frontend `userService` module for user management operations.

**Acceptance Criteria:**
- `userService.js` exports:
  - `getUsers()` — list all users
  - `createUser(data)` — create user
  - `getUser(id)` — get user details
  - `updateUser(id, data)` — update user
  - `deleteUser(id)` — delete user
  - `resetPassword(id, data)` — admin password reset
  - `updateUserRoles(id, roleIds)` — assign roles
  - `getRoles()` — list all roles
  - `createRole(data)` — create role
  - `deleteRole(id)` — delete role
  - `getAllPages()` — list all pages
  - `getRolePages(roleId)` — get role's pages
  - `updateRolePages(roleId, pageIds)` — assign pages to role
  - `getAllPermissions()` — list all permissions
  - `getRolePermissions(roleId)` — get role's permissions
  - `updateRolePermissions(roleId, permissionIds)` — assign permissions to role
- Error handling with meaningful messages

---

### T-08.03 — Build User Management Page: Users Tab

**Description:** Create the Users tab of the User Management page for managing user accounts.

**Acceptance Criteria:**
- Users table with columns: Username, Full Name, Roles, Status (Active/Inactive), Created Date, Last Login
- Action buttons per row: Edit, Reset Password, Delete
- "Create User" button opens a form:
  - Fields: username (required), password (required), full name, role selection (multi-select)
  - Validation: username uniqueness, password requirements
  - Save creates user and shows success toast
- "Edit User" dialog:
  - Editable: full name, active status
  - Role assignment via multi-select checkbox list
  - Save updates user and shows success toast
- "Reset Password" dialog:
  - Admin enters new password for the user
  - Confirmation required
- "Delete User" dialog:
  - Confirmation required
  - Deletes (or deactivates) the user
- Sort and search within user table
- Page registered with permission name `user_management`

**Key Detail:**
- Exact users table columns:
  - **User** — shows `full_name` with `username` below (with UserIcon)
  - **Roles** — badge per assigned role
  - **Status** — Active (green badge) or Inactive (red badge)
  - **Last Login** — `last_login_at` timestamp or "Never" if null
  - **Actions** — Edit, Change Password, Delete (delete not available for self)
- Create User form field validations:
  - `username`: required, must be lowercase letters, numbers, dots, dashes, or underscores only
  - `password`: required, minimum 8 characters
  - `full_name`: required
  - `roleIds`: at least one role must be selected (checkbox list)
  - `username` is only editable during creation, not during edit
- Edit User form fields:
  - `full_name`: required
  - `is_active`: checkbox toggle
  - `roleIds`: checkbox list of all available roles
- Reset Password form:
  - `newPassword`: required, minimum 8 characters

---

### T-08.04 — Build User Management Page: Roles Tab

**Description:** Create the Roles tab of the User Management page for managing roles and their page/permission assignments.

**Acceptance Criteria:**
- Roles list/table with columns: Role Name, Description, User Count, Pages Count, Permissions Count
- "Create Role" button opens a form:
  - Fields: name (required), description
  - Save creates role and shows success toast
- "Delete Role" button with confirmation (only if no users assigned)
- Role detail panel (click a role to expand or navigate):
  - **Pages tab:** checkbox list of all available pages; checked = assigned to this role; save updates assignment
  - **Permissions tab:** checkbox list of all available permissions; checked = assigned to this role; save updates assignment
- Changes take effect on next login for affected users

**Key Detail:**
- Exact roles table columns:
  - **Role Name** — `name` (with ShieldCheckIcon)
  - **Description** — `description` or "No description" placeholder
  - **Type** — System (blue badge, non-deletable) or Custom (green badge, deletable)
  - **Actions** — Edit, Delete (delete only for non-system roles with no users assigned)
- Role edit form includes:
  - `name`: required, disabled when editing (read-only for existing roles)
  - `description`: optional, only available during creation
  - `pageIds`: hierarchical checkbox list — parent pages show with children indented; checking a parent auto-checks children
  - `permissionIds`: checkbox list grouped by resource (e.g., all `users.*` permissions grouped together)
- System roles (`admin`, `user`) are flagged with `is_system_role` and cannot be deleted

---

### T-08.05 — Implement Admin Setup Script

**Description:** Create a CLI script for setting up the initial admin user when deploying the application for the first time.

**Acceptance Criteria:**
- `scripts/setup-admin-user.js` creates an admin user with:
  - Default username (configurable)
  - Password (provided as argument or prompted)
  - Admin role with all pages and permissions
- Can also unlock a locked-out admin account: `scripts/unlock-user.js`
- Scripts connect directly to PostgreSQL (no server running required)
- Idempotent: safe to re-run

---

## User Stories

### US-08.01 — Admin Can Create New User Accounts

**As an** administrator, **I want to** create user accounts for team members **so that** they can log in to the Deployment Assistant with appropriate access.

**Acceptance Criteria:**
- I can specify username, password, full name, and roles for the new user
- The system validates that the username is unique
- The new user can log in immediately after creation
- The new user sees only the pages and features their assigned roles grant

**Key Detail:**
- Username validation: lowercase letters, numbers, dots, dashes, underscores only
- Password requirement: minimum 8 characters
- At least one role must be assigned during creation
- Available seed roles: `admin` (full access), `user` (standard access)

**Dependencies:** T-08.01, T-08.02, T-08.03

---

### US-08.02 — Admin Can Manage User Roles

**As an** administrator, **I want to** create roles and assign them to users **so that** I can control what different team members can access.

**Acceptance Criteria:**
- I can create new roles with a name and description
- I can assign one or more roles to a user
- I can change a user's roles at any time
- Role changes take effect on the user's next login
- I can delete a role if no users are assigned to it

**Key Detail:**
- System roles (`admin`, `user`) cannot be deleted
- Role type badge: System (blue) or Custom (green)
- New custom roles start with no pages or permissions — admin must explicitly assign them

**Dependencies:** T-08.01, T-08.02, T-08.03, T-08.04

---

### US-08.03 — Admin Can Configure Page Access per Role

**As an** administrator, **I want to** control which pages each role can access **so that** users only see navigation items and pages relevant to their responsibilities.

**Acceptance Criteria:**
- I can view which pages are assigned to a role
- I can add or remove page access via checkboxes
- Changes are reflected in the sidebar for affected users (on next login)
- I can see the full list of available pages

**Key Detail:**
- Pages are displayed hierarchically: parent pages (e.g., `analytics`) shown with children (e.g., `analytics.overview`, `analytics.account_history`) indented below
- Full page list: `dashboard`, `analytics` (with `analytics.overview`, `analytics.account_history`, `analytics.package_changes`), `provisioning` (with `provisioning.monitor`, `provisioning.expiration`, `provisioning.ghost_accounts`, `provisioning.audit_trail`), `customer_products`, `custom_reports`, `user_management`, `help`, `settings`

**Dependencies:** T-08.01, T-08.04

---

### US-08.04 — Admin Can Configure Permissions per Role

**As an** administrator, **I want to** assign fine-grained permissions to roles **so that** I can control access to specific features (e.g., Salesforce service account, report creation).

**Acceptance Criteria:**
- I can view which permissions are assigned to a role
- I can add or remove permissions via checkboxes
- Permissions include: `salesforce.service_account`, `custom_reports.create`, `custom_reports.view`, etc.
- Changes affect what features are available to users in that role

**Key Detail:**
- Full list of seed permissions (resource.action format): `users.create`, `users.read`, `users.update`, `users.delete`, `users.manage`, `roles.create`, `roles.read`, `roles.update`, `roles.delete`, `roles.assign`, `roles.manage`, `expiration_monitor.read`, `expiration_monitor.write`, `packages.read`, `packages.write`, `ghost_accounts.read`, `ghost_accounts.write`, `salesforce.access`, `salesforce.service_account`, `sml.access`
- Permissions displayed grouped by resource (e.g., all `users.*` permissions together, all `roles.*` together)

**Dependencies:** T-08.01, T-08.04

---

### US-08.05 — Admin Can Reset a User's Password

**As an** administrator, **I want to** reset a user's password **so that** I can help team members who are locked out or have forgotten their credentials.

**Acceptance Criteria:**
- I can select a user and set a new password for them
- The user can log in with the new password immediately
- The old password no longer works
- A confirmation dialog prevents accidental resets

**Key Detail:**
- New password requirement: minimum 8 characters
- Endpoint: `PUT /api/users/:id/password` with body `{ newPassword }`

**Dependencies:** T-08.01, T-08.03

---

### US-08.06 — Admin Can Activate or Deactivate Users

**As an** administrator, **I want to** deactivate user accounts for team members who have left **so that** they can no longer access the application.

**Acceptance Criteria:**
- I can toggle a user's active status
- Deactivated users cannot log in
- Deactivated users' existing sessions are invalidated
- I can reactivate a previously deactivated user

**Key Detail:**
- Active status shown as badge: Active (green), Inactive (red)
- Status toggled via the `is_active` checkbox in the Edit User dialog

**Dependencies:** T-08.01, T-08.03

---

### US-08.07 — User Can Change Their Own Password

**As a** user, **I want to** change my own password **so that** I can maintain the security of my account.

**Acceptance Criteria:**
- Password change available via `POST /api/auth/change-password`
- Must provide current password for verification
- New password must meet minimum requirements
- Success message confirms the change
- I remain logged in after changing my password

**Key Detail:**
- Request body: `{ currentPassword, newPassword }`
- Minimum password length: 8 characters
- Response: `{ success: true, message: 'Password changed successfully' }`

**Dependencies:** T-01.06 (Auth routes from Infrastructure epic)
