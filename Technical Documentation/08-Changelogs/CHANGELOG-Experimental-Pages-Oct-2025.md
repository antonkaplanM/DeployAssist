# Changelog - Experimental Pages & Roadmap

## Version 1.0.0 - October 22, 2025

### 🎉 New Features

#### Experimental Pages Section
- **Added** new "Experimental Pages" navigation section in sidebar
- **Added** expandable/collapsible menu for experimental features
- **Integrated** with existing page-level authorization system
- **Added** database migrations for page entitlements

#### Roadmap Sub-Page
- **Created** complete Roadmap page with Jira integration
- **Implemented** Jira REST API v3 integration for real-time data
- **Added** assignee-based initiative loading (defaults to "Kevin Yu")
- **Added** live search functionality across all fields
- **Added** status dropdown filter (Open, In Progress, Proposed, Committed, Done, Closed)
- **Added** sortable columns (Key, Summary, Status, Created, Updated)
- **Added** CSV export functionality with filtered data
- **Implemented** responsive design with dark mode support
- **Added** loading states, error handling, and empty state messages
- **Fixed** Atlassian Document Format (ADF) description rendering

### 🔧 Technical Changes

#### Frontend
- Created `frontend/src/pages/Roadmap.jsx` component
- Updated `frontend/src/App.jsx` with new route `/experimental/roadmap`
- Updated `frontend/src/components/layout/Sidebar.jsx` with Experimental Pages section
- Added ADF text extraction for Jira descriptions
- Integrated with `ProtectedRoute` for authorization

#### Backend
- Existing Jira API endpoint `/api/jira/initiatives` already supported (no changes needed)
- API supports both real Jira data and fallback data

#### Database
- Created `database/init-scripts/10-experimental-pages.sql` migration
- Created `database/add-experimental-pages.sql` standalone script
- Added `experimental` parent page
- Added `experimental.roadmap` sub-page
- Assigned permissions to admin and user roles

### 📚 Documentation
- Created comprehensive feature documentation
- Added setup guides and troubleshooting
- Documented API integration details
- Added usage instructions and examples

### 🔒 Authorization
- Fully integrated with page-level permissions
- Dynamic sidebar based on user roles
- Protected routes with ProtectedRoute component
- Can be managed via User Management UI

### 🐛 Bug Fixes
- Fixed React error rendering Jira ADF format descriptions
- Added text extraction helper functions for ADF objects
- Proper handling of both plain text and ADF descriptions in CSV export

### 📋 Database Migration

**New Pages:**
- `experimental` - Experimental Pages (parent)
- `experimental.roadmap` - Roadmap sub-page

**Permissions:**
- Admin role: Full access ✅
- User role: Full access ✅ (can be restricted via User Management)

### 🔗 Related Issues
- Closes: Request for Roadmap feature in new React app
- Related: Jira integration enhancement

### 📝 Notes
- Roadmap page requires `ATLASSIAN_SITE_URL` in `.env` file
- Works with existing Jira API credentials
- Backward compatible with old app's roadmap functionality
- ADF description rendering automatically handled

---

**Migration Required:** Yes  
**Breaking Changes:** None  
**Database Changes:** Yes (new pages table entries)  
**API Changes:** None (uses existing endpoint)  
**UI Changes:** New navigation section and page


