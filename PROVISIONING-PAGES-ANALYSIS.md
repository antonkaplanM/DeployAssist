# Provisioning Pages - Complete Feature Analysis

**Date:** October 20, 2025  
**Status:** Feature gap analysis between old app and new React pages

---

## Provisioning Requests Page

### Current Implementation (React) ❌
- 6 columns only
- Basic search
- Basic filters
- Simple pagination
- No export
- No validation display
- No actions menu
- No product details

### Required Features (Old App) ✅
**Table Columns (11 total):**
1. Technical Team Request (Name)
2. Account (with Account_Site__c subtitle)
3. Request Type (TenantRequestAction__c)
4. Deployment Number (Deployment__r.Name)
5. **Tenant Name** (from parsedPayload.tenantName)
6. **Products** (interactive buttons with modal)
   - Models count (clickable)
   - Data count (clickable)
   - Apps count (clickable)
   - Total count
7. **Data Validations** (Pass/Fail badge with tooltip)
8. Status (with SMLErrorMessage__c detection)
9. Created Date
10. Created By
11. **Actions** (dropdown menu)

**Features:**
- ✅ Type-ahead search
- ✅ Filter by Request Type
- ✅ Filter by Status
- ✅ Pagination
- ❌ Export to CSV
- ❌ Column sorting
- ❌ Product detail modals
- ❌ Validation engine
- ❌ Actions dropdown

**Actions Menu:**
- View Account History
- View in Salesforce
- View Customer Products
- Copy PS Record ID
- Copy Account Name
- Copy Deployment Number
- Refresh single record

---

## Customer Products Page

### Current Implementation (React) ⚠️
- Search by account name
- Products grouped by region
- Products categorized (Models, Data, Apps)
- Expiration tracking
- Days remaining
- Clear button

### Required Features (Old App) ✅
- ✅ Account search with autocomplete
- ✅ Regional grouping
- ✅ Category grouping (Models, Data, Apps)
- ✅ Expiration dates
- ✅ Days remaining with color coding
- ❌ View Account History button
- ❌ "Contributing PS Records" list
- ❌ Product quantity display
- ❌ Product modifier display
- ❌ Package name display

**Additional Features:**
- Shows which PS records contribute to each product
- Links to view those specific PS records
- Shows product quantities and modifiers
- More detailed product information

---

## Product Removals Page

### Current Implementation (React) ⚠️
- Time frame selector
- Summary statistics
- Removal categorization
- Basic details

### Required Features (Old App) ✅
- ✅ Time frame selector
- ✅ Summary stats
- ✅ Product categorization
- ❌ Comparison view (Before/After)
- ❌ Removed vs Remaining products
- ❌ Tenant name display
- ❌ Action type display
- ❌ Deployment number display
- ❌ Site information
- ❌ More detailed removal breakdown

---

## Priority Fixes

### HIGH PRIORITY (Core functionality)
1. **Provisioning Requests:**
   - Add Tenant Name column
   - Add Products column with modal
   - Add Data Validations column
   - Add Actions dropdown menu
   - Add Export to CSV button
   - Integrate validation engine
   - Fix status display (SMLErrorMessage__c)

2. **Customer Products:**
   - Add View Account History button
   - Add contributing PS records list
   - Add product quantities/modifiers
   - Improve product details

3. **Product Removals:**
   - Add Before/After comparison
   - Add Removed vs Remaining view
   - Add more request details
   - Improve removal breakdown

### MEDIUM PRIORITY (UX improvements)
4. **Provisioning Requests:**
   - Add column sorting
   - Add type-ahead suggestions
   - Add loading skeletons
   - Add row hover details

5. **All Pages:**
   - Add refresh timestamps
   - Add auto-refresh option
   - Add keyboard shortcuts
   - Add better error messages

### LOW PRIORITY (Nice to have)
6. **Provisioning Requests:**
   - Add bulk actions
   - Add filters persistence
   - Add column customization
   - Add saved searches

---

## Technical Debt

### Validation Engine
- Need to integrate ValidationEngine from old app
- Pass/Fail logic with detailed tooltips
- Support for multiple validation rules
- Rule configuration UI

### Product Modal
- Show entitlement details
- Format dates properly
- Show product codes, packages, modifiers
- Support for all product types

### Actions Menu
- Account History navigation
- Salesforce integration links
- Copy to clipboard functionality
- Single record refresh

---

## Recommended Approach

### Phase 3A: Fix Provisioning Requests (HIGH PRIORITY)
1. Add missing columns (Tenant Name, Products, Validation, Actions)
2. Implement product modal component
3. Integrate validation engine
4. Add Export to CSV
5. Fix status handling

### Phase 3B: Enhance Customer Products
1. Add View Account History button
2. Show contributing PS records
3. Add product details (quantity, modifier, package)

### Phase 3C: Enhance Product Removals
1. Add Before/After comparison view
2. Show removed vs remaining products
3. Add more details per request

### Phase 3D: Polish & Testing
1. Add column sorting to all tables
2. Add loading skeletons
3. Improve error handling
4. Test all features thoroughly

---

## Next Steps

User has requested to analyze and revise the pages to match the old app structure.

**Recommendation:** Let's tackle Phase 3A first - fix Provisioning Requests with all missing columns and features. Once that's solid, we can enhance the other two pages.



