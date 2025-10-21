# Navigation Restructure - Alignment with Old App

## ✅ Changes Made

### 1. **Sidebar Navigation Structure**
Restructured the main navigation to match the old app's organization:

**OLD Structure:**
```
- Dashboard
- Analytics
  - Overview
  - Account History
  - Package Changes
- Provisioning
  - Requests ❌
  - Customer Products ❌ (wrong location)
  - Product Removals ❌ (shouldn't exist)
- Monitoring
  - Expiration Monitor
  - Validation Errors
  - PS Audit Trail
- User Management
- Settings
```

**NEW Structure (Aligned with Old App):**
```
- Dashboard
- Analytics
  - Overview
  - Account History
  - Package Changes
- Provisioning Monitor
  - Provisioning Monitor (main page)
  - Expiration Monitor ✅
  - Ghost Accounts ✅
  - Audit Trail ✅
- Customer Products ✅ (standalone)
- User Management
- Settings
```

### 2. **Route Changes**

#### Removed Routes:
- `/provisioning/requests` → Changed to `/provisioning`
- `/provisioning/customer-products` → Moved to `/customer-products`
- `/provisioning/product-removals` → **DELETED** (doesn't exist in old app)
- `/monitoring/expiration` → Moved to `/provisioning/expiration`
- `/monitoring/validation` → Removed (not in old app)
- `/monitoring/audit-trail` → Moved to `/provisioning/audit-trail`

#### New/Updated Routes:
- `/provisioning` - Provisioning Monitor (main page)
- `/provisioning/expiration` - Expiration Monitor
- `/provisioning/ghost-accounts` - Ghost Accounts (NEW PAGE)
- `/provisioning/audit-trail` - PS Audit Trail
- `/customer-products` - Customer Products (standalone)

### 3. **Files Created**
- ✅ `frontend/src/pages/GhostAccounts.jsx` - New page for Ghost Accounts monitoring

### 4. **Files Deleted**
- ❌ `frontend/src/pages/ProductRemovals.jsx` - Removed (not in old app)

### 5. **Files Modified**
- ✅ `frontend/src/components/layout/Sidebar.jsx` - Updated navigation structure
- ✅ `frontend/src/App.jsx` - Updated routes to match new structure

## 🎯 Key Features

### Provisioning Monitor Section
Now properly groups all provisioning-related monitoring pages:
1. **Provisioning Monitor** - Main PS request monitoring
2. **Expiration Monitor** - Product expiration tracking
3. **Ghost Accounts** - Stale account detection
4. **Audit Trail** - PS record audit history

### Customer Products
- Moved to standalone navigation item (not under Provisioning)
- Accessible via direct link or from Provisioning Monitor actions menu
- Route: `/customer-products`

## 📝 Next Steps

### Remaining Work:
1. **Test navigation** - Verify all links work correctly in browser
2. **Update any hardcoded links** - Check for references to old paths
3. **Update documentation** - Help pages, README, etc.
4. **Backend API** - Ensure `/api/ghost-accounts` endpoint exists

### Navigation IDs for Testing:
- `#nav-provisioning` - Provisioning Monitor main nav
- `#nav-provisioning-monitor` - Provisioning Monitor sub-nav
- `#nav-expiration` - Expiration Monitor sub-nav
- `#nav-ghost-accounts` - Ghost Accounts sub-nav
- `#nav-audit-trail` - Audit Trail sub-nav
- `#nav-customer-products` - Customer Products main nav
- `#provisioning-subnav` - Provisioning submenu container

## 🔄 Migration Impact

### For Users:
- **Bookmarked URLs** may need updating:
  - Old: `/provisioning/requests` → New: `/provisioning`
  - Old: `/provisioning/customer-products` → New: `/customer-products`
  - Old: `/monitoring/expiration` → New: `/provisioning/expiration`
  - Old: `/monitoring/audit-trail` → New: `/provisioning/audit-trail`

### For Developers:
- All `useNavigate` calls referencing old paths should be updated
- Check `ActionsMenu` component for correct navigation
- Verify E2E tests use correct paths

## ✨ Benefits

1. **Consistency** - Matches old app structure users are familiar with
2. **Logical Grouping** - All provisioning monitoring in one section
3. **Simplified** - Removed "Monitoring" section redundancy
4. **Feature Parity** - Ghost Accounts page now exists
5. **Clean Separation** - Customer Products is standalone, not buried under Provisioning

---

**Status:** ✅ Complete - Ready for testing
**Date:** 2025-10-21

