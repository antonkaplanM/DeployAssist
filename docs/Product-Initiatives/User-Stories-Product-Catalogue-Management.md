# User Stories: Product Catalogue Management

## Overview
This document outlines the user stories for the Product Catalogue Management feature, enabling authorized users (specifically PMs responsible for customer enablement) to search, filter, edit, and manage product data in the centralized product catalogue. The system supports both UI and API interfaces for effective management of products, models, and data sets as they are introduced, updated, or removed.

## Target Users
- **Product Managers (PMs)**: Primary users responsible for customer enablement and catalogue maintenance
- **Catalogue Administrators**: Users with elevated permissions for data management
- **Data Analysts**: Users who need to query and export data for analysis
- **Integration Systems**: External tools that interact via API

---

## Epics

1. **Filtering & Search**: Efficiently locating products using filters, search, and type-ahead functionality
2. **Data Viewing & Sorting**: Displaying and organizing results for effective review
3. **Inline & Bulk Editing**: Making changes to individual or multiple records efficiently
4. **Data Creation & Import**: Adding new entries individually or in bulk
5. **Data Export**: Exporting filtered results to standard formats
6. **Data Deletion**: Removing records individually or in bulk
7. **API Integration**: Programmatic access to all catalogue operations
8. **Environment Promotion**: Managing data changes across environments (NPE → PPE → PE)

---

## User Stories

### Epic 1: Filtering & Search

#### Story 1.1: Filter by Table Name
**As a** Product Manager,  
**I want to** filter the catalogue view by selecting a specific table name (e.g., Packages, Entitlement Codes, Products),  
**So that** I can focus on a particular dataset without seeing unrelated records.

**Acceptance Criteria:**
- [ ] Dropdown or selector at the top of the catalogue page listing all available tables
- [ ] Selecting a table refreshes the view to show only records from that table
- [ ] Table selection persists during the session until changed
- [ ] Column headers update to reflect the attributes of the selected table
- [ ] Default table is configurable or remembers last selection

---

#### Story 1.2: Filter by Configurable Attributes
**As a** Product Manager,  
**I want to** filter records by a set of pre-defined attributes (provided per table),  
**So that** I can narrow down the dataset to records matching specific criteria.

**Acceptance Criteria:**
- [ ] Filter panel displays only attributes applicable to the selected table
- [ ] Attributes available for filtering are configurable per table (specified in configuration)
- [ ] Filters support multi-select (OR logic within same attribute)
- [ ] Multiple attribute filters apply with AND logic between them
- [ ] Filter options are dynamically populated from existing data values
- [ ] Active filters are clearly displayed with ability to remove individually
- [ ] "Clear All Filters" button is available
- [ ] Filter state is preserved when navigating within the application

---

#### Story 1.3: Search Within Filtered Results (Universal Search)
**As a** Product Manager,  
**I want to** search across all attribute values without specifying which attribute to search,  
**So that** I can quickly find records when I only know part of the value (e.g., a date, code, or name fragment).

**Acceptance Criteria:**
- [ ] Single search input field prominently displayed
- [ ] Search operates within the current filtered results
- [ ] Search matches against ALL attribute values in the visible columns
- [ ] Entering a date (e.g., "2024-01-15") returns any record containing that date in any attribute
- [ ] Entering a partial code returns records where any attribute contains that code
- [ ] Search is case-insensitive
- [ ] Results highlight matching terms (optional enhancement)
- [ ] "No results found" message when search yields no matches

---

#### Story 1.4: Type-Ahead Search
**As a** Product Manager,  
**I want to** see search suggestions as I type,  
**So that** I can quickly find and select the record I'm looking for without typing the complete value.

**Acceptance Criteria:**
- [ ] Suggestions appear after 2-3 characters are typed
- [ ] Suggestions are drawn from existing data values in the filtered dataset
- [ ] Maximum of 10 suggestions displayed at a time
- [ ] Suggestions update in real-time as user continues typing
- [ ] Clicking a suggestion immediately filters to matching records
- [ ] Keyboard navigation (up/down arrows, Enter to select) is supported
- [ ] Type-ahead has a debounce to prevent excessive API calls (e.g., 300ms)
- [ ] Loading indicator shown while suggestions are being fetched

---

### Epic 2: Data Viewing & Sorting

#### Story 2.1: Sort by Orderable Attributes
**As a** Product Manager,  
**I want to** sort the filtered results by any attribute that can be logically ordered,  
**So that** I can organize the data in a way that supports my review or decision-making.

**Acceptance Criteria:**
- [ ] Clickable column headers for sortable attributes
- [ ] Sort direction indicator (ascending/descending arrow)
- [ ] Click once for ascending, click again for descending, third click removes sort
- [ ] Sortable attributes include: dates, numbers, alphabetical text fields
- [ ] Non-sortable attributes (e.g., JSON blobs, complex objects) have disabled sort
- [ ] Sorting applies to the current filtered/searched dataset
- [ ] Multi-column sort supported (Shift+Click for secondary sort)
- [ ] Default sort order is configurable per table

---

#### Story 2.2: View Record Details
**As a** Product Manager,  
**I want to** click on a record to view all its attributes in detail,  
**So that** I can see information that may not be visible in the summary table.

**Acceptance Criteria:**
- [ ] Clicking a row opens a detail panel (modal or slide-out)
- [ ] All attributes from the selected table are displayed
- [ ] Read-only mode by default
- [ ] "Edit" button available for authorized users
- [ ] "Close" button to return to the table view
- [ ] Navigation to previous/next record without closing detail view

---

### Epic 3: Inline & Bulk Editing

#### Story 3.1: Inline Edit Single Record
**As a** Product Manager,  
**I want to** edit attribute values directly in the table row,  
**So that** I can make quick updates without opening a separate form.

**Acceptance Criteria:**
- [ ] Double-click on a cell to enter edit mode (for editable fields)
- [ ] Editable cells display appropriate input controls (text, dropdown, date picker)
- [ ] Non-editable fields (e.g., ID, created date) are visually indicated and cannot be edited
- [ ] Enter key saves the change; Escape key cancels
- [ ] Tab key saves and moves to the next editable cell
- [ ] Visual indicator (e.g., yellow highlight) shows unsaved changes
- [ ] Validation errors displayed inline (e.g., red border, tooltip message)
- [ ] Save confirmation or auto-save with success notification
- [ ] Undo capability for recent changes

---

#### Story 3.2: Bulk Edit Multiple Records
**As a** Product Manager,  
**I want to** select multiple records and apply the same change to all of them,  
**So that** I can efficiently update a batch of records with a common attribute value.

**Acceptance Criteria:**
- [ ] Checkbox column for row selection
- [ ] "Select All" checkbox in header (applies to current page or all filtered results with confirmation)
- [ ] Selected row count displayed prominently
- [ ] "Bulk Edit" button appears when records are selected
- [ ] Bulk edit modal allows selecting which attribute(s) to update
- [ ] Only editable attributes are available for bulk edit
- [ ] Preview of changes before applying
- [ ] Confirmation dialog showing number of records to be affected
- [ ] Progress indicator for bulk operations
- [ ] Summary of successful/failed updates after completion
- [ ] Rollback option if bulk operation encounters errors

---

### Epic 4: Data Creation & Import

#### Story 4.1: Create New Entry
**As a** Product Manager,  
**I want to** create a new entry by selecting a table and providing values for all mandatory fields,  
**So that** I can add new products, packages, or entitlement codes to the catalogue.

**Acceptance Criteria:**
- [ ] "Add New" button available on the catalogue page
- [ ] Form displays fields appropriate to the selected table
- [ ] Mandatory fields are clearly marked (e.g., asterisk, different styling)
- [ ] Optional fields are available but not required
- [ ] Field-level validation (format, length, required)
- [ ] Dropdown fields populated with valid options from reference data
- [ ] "Save" and "Cancel" buttons
- [ ] Success notification with link to view the new record
- [ ] Error handling with clear messages for validation failures
- [ ] Form clears after successful save (with option to create another)

---

#### Story 4.2: Bulk Upload from CSV Template
**As a** Product Manager,  
**I want to** upload multiple new entries at once using a CSV file,  
**So that** I can efficiently add many records without manual entry.

**Acceptance Criteria:**
- [ ] "Bulk Upload" button available on the catalogue page
- [ ] First step: Select the target table
- [ ] "Download Template" button provides table-specific CSV template
- [ ] Template includes column headers matching the table's attributes
- [ ] Template includes example row(s) showing expected format
- [ ] File upload supports drag-and-drop and file browser
- [ ] CSV parsing validates file format before processing
- [ ] Preview screen shows parsed data before import
- [ ] Validation errors displayed per row with specific issues
- [ ] Option to proceed with valid rows only (skip invalid)
- [ ] Progress indicator during import
- [ ] Summary report after import: successful, failed, skipped counts
- [ ] Downloadable error report for failed rows with reasons

---

### Epic 5: Data Export

#### Story 5.1: Export Results to Excel/CSV
**As a** Product Manager,  
**I want to** export the current filtered/searched results to Excel or CSV format,  
**So that** I can share the data with stakeholders or perform offline analysis.

**Acceptance Criteria:**
- [ ] "Export" button available on the catalogue page
- [ ] Export respects current filters, search, and sort order
- [ ] Option to select export format: CSV or Excel (.xlsx)
- [ ] Option to export all columns or select specific columns
- [ ] Export includes column headers matching display names
- [ ] Large exports handled gracefully (streaming or background processing)
- [ ] Download initiated automatically upon completion
- [ ] File naming includes table name and export date (e.g., "Packages_2024-01-15.csv")
- [ ] Export limited to reasonable row count with warning for large datasets

---

### Epic 6: Data Deletion

#### Story 6.1: Delete Single Record
**As a** Product Manager,  
**I want to** delete a single record from the catalogue,  
**So that** I can remove obsolete or erroneous entries.

**Acceptance Criteria:**
- [ ] "Delete" button/icon available on each row (for authorized users)
- [ ] Confirmation dialog before deletion ("Are you sure?")
- [ ] Dialog shows key identifying information of the record being deleted
- [ ] Soft delete option (mark as inactive) vs. hard delete configurable
- [ ] Success notification after deletion
- [ ] Record removed from current view immediately
- [ ] Audit trail captures deletion with timestamp and user

---

#### Story 6.2: Bulk Delete Multiple Records
**As a** Product Manager,  
**I want to** delete multiple selected records at once,  
**So that** I can efficiently clean up batches of obsolete data.

**Acceptance Criteria:**
- [ ] "Bulk Delete" button appears when records are selected
- [ ] Confirmation dialog showing exact count of records to be deleted
- [ ] List of record identifiers shown in confirmation (or first N with "and X more")
- [ ] Option to require secondary confirmation for large deletions (e.g., >10 records)
- [ ] Progress indicator for bulk delete operation
- [ ] Summary of successful/failed deletions after completion
- [ ] Audit trail captures all deletions with details

---

### Epic 7: API Integration

#### Story 7.1: API - Filter and Search
**As an** Integration System,  
**I want to** query the catalogue via API with filter and search parameters,  
**So that** I can programmatically retrieve relevant records.

**Acceptance Criteria:**
- [ ] GET endpoint accepts table name as path parameter or query parameter
- [ ] Query parameters for each filterable attribute
- [ ] Query parameter for universal search term
- [ ] Pagination support (page, pageSize, offset, limit)
- [ ] Sort parameters (sortBy, sortOrder)
- [ ] Response includes total count for pagination
- [ ] Response format: JSON with consistent structure
- [ ] API documentation (OpenAPI/Swagger) available
- [ ] Rate limiting to prevent abuse

**Example:**
```
GET /api/catalogue/packages?region=NAM&status=active&search=2024&page=1&pageSize=50&sortBy=createdDate&sortOrder=desc
```

---

#### Story 7.2: API - Create Record
**As an** Integration System,  
**I want to** create new records via API,  
**So that** external tools can add entries to the catalogue programmatically.

**Acceptance Criteria:**
- [ ] POST endpoint for each table
- [ ] Request body contains attribute values in JSON format
- [ ] Server-side validation with detailed error responses
- [ ] Successful creation returns 201 status with created record
- [ ] Validation failures return 400 status with field-level errors
- [ ] Authentication required (API key or OAuth token)

**Example:**
```
POST /api/catalogue/packages
Content-Type: application/json
{
  "packageCode": "PKG-2024-001",
  "name": "Enterprise Bundle",
  "region": "NAM",
  ...
}
```

---

#### Story 7.3: API - Update Record
**As an** Integration System,  
**I want to** update existing records via API,  
**So that** external tools can modify catalogue entries programmatically.

**Acceptance Criteria:**
- [ ] PUT/PATCH endpoint for updating records
- [ ] Record identified by unique ID in path
- [ ] Partial updates supported (PATCH with only changed fields)
- [ ] Optimistic concurrency control (version field or ETag)
- [ ] Conflict response (409) if record was modified since read
- [ ] Successful update returns updated record

**Example:**
```
PATCH /api/catalogue/packages/PKG-2024-001
Content-Type: application/json
{
  "status": "inactive",
  "endDate": "2024-12-31"
}
```

---

#### Story 7.4: API - Delete Record
**As an** Integration System,  
**I want to** delete records via API,  
**So that** external tools can remove entries from the catalogue programmatically.

**Acceptance Criteria:**
- [ ] DELETE endpoint for each table
- [ ] Record identified by unique ID in path
- [ ] Soft delete supported via query parameter
- [ ] Successful deletion returns 204 (no content) or 200 with confirmation
- [ ] 404 returned if record not found

**Example:**
```
DELETE /api/catalogue/packages/PKG-2024-001?soft=true
```

---

#### Story 7.5: API - Bulk Operations
**As an** Integration System,  
**I want to** perform bulk create, update, and delete operations via API,  
**So that** external tools can efficiently process large batches of changes.

**Acceptance Criteria:**
- [ ] POST endpoint for bulk create (array of records in body)
- [ ] PATCH endpoint for bulk update (array of record updates)
- [ ] DELETE endpoint for bulk delete (array of IDs in body)
- [ ] Maximum batch size enforced (e.g., 1000 records)
- [ ] Response includes per-record success/failure status
- [ ] Partial success allowed (some records succeed, others fail)
- [ ] Transaction option for all-or-nothing semantics

**Example:**
```
POST /api/catalogue/packages/bulk
Content-Type: application/json
{
  "operation": "create",
  "records": [
    { "packageCode": "PKG-001", ... },
    { "packageCode": "PKG-002", ... }
  ]
}
```

---

#### Story 7.6: API - Export
**As an** Integration System,  
**I want to** export catalogue data via API,  
**So that** external tools can retrieve data in bulk for reporting or synchronization.

**Acceptance Criteria:**
- [ ] GET endpoint with Accept header for format (application/json, text/csv, application/vnd.ms-excel)
- [ ] Same filter/search parameters as query endpoint
- [ ] Streaming response for large datasets
- [ ] Optional column selection via query parameter

**Example:**
```
GET /api/catalogue/packages/export?format=csv&region=NAM
Accept: text/csv
```

---

### Epic 8: Environment Promotion

#### Story 8.1: NPE as Primary Editing Environment
**As a** Product Manager,  
**I want** all data editing operations to be restricted to the NPE (Non-Production Environment),  
**So that** changes are tested and validated before affecting production data.

**Acceptance Criteria:**
- [ ] All create, update, and delete operations only available in NPE
- [ ] UI clearly indicates current environment (NPE/PPE/PE) in header/banner
- [ ] Environment indicator uses distinct colors (e.g., green=NPE, yellow=PPE, red=PE)
- [ ] Edit buttons/controls hidden or disabled in PPE and PE
- [ ] API write operations return 403 Forbidden in PPE and PE with clear message
- [ ] Read-only mode automatically enforced in PPE and PE

---

#### Story 8.2: Promote Changes from NPE to PPE
**As a** Product Manager,  
**I want to** promote validated changes from NPE to PPE (Pre-Production Environment),  
**So that** changes can undergo additional testing before going to production.

**Acceptance Criteria:**
- [ ] "Promote to PPE" button available in NPE
- [ ] Changes tracked with promotion status (pending, promoted, synced)
- [ ] Preview of changes to be promoted (diff view)
- [ ] Comparison between NPE and PPE states for affected records
- [ ] Confirmation dialog with summary of changes
- [ ] Promotion requires appropriate authorization/role
- [ ] Progress indicator during promotion
- [ ] Success/failure notification with details
- [ ] Audit trail records promotion action, user, and timestamp
- [ ] Rollback capability if promotion causes issues

---

#### Story 8.3: Promote Changes from PPE to PE
**As a** Product Manager,  
**I want to** promote validated changes from PPE to PE (Production Environment),  
**So that** approved changes become available in the production catalogue.

**Acceptance Criteria:**
- [ ] "Promote to PE" button available in PPE (or NPE with PPE as intermediate)
- [ ] Additional approval workflow for production promotion (optional)
- [ ] Final review screen showing all changes going to production
- [ ] Comparison between PPE and PE states
- [ ] Higher authorization level required for PE promotion
- [ ] Scheduled promotion option (deploy during maintenance window)
- [ ] Dry-run mode to validate promotion without applying
- [ ] Detailed audit trail for production changes
- [ ] Notification to stakeholders upon successful promotion
- [ ] Rollback plan documented for each promotion

---

#### Story 8.4: View Promotion History
**As a** Product Manager,  
**I want to** view the history of promotions between environments,  
**So that** I can track when changes were deployed and by whom.

**Acceptance Criteria:**
- [ ] "Promotion History" accessible from catalogue management
- [ ] List shows: promotion date, source env, target env, user, status
- [ ] Filter by date range, user, status
- [ ] Drill-down to see specific records included in a promotion
- [ ] Export promotion history for audit purposes

---

## Non-Functional Requirements

### Security
- All operations require authentication
- Role-based access control (RBAC) for different permission levels
- Audit logging for all data modifications
- API rate limiting to prevent abuse

### Performance
- Page load time < 2 seconds for typical filtered views
- Search type-ahead response < 300ms
- Bulk operations support up to 1000 records per request
- Export handles datasets up to 100,000 rows

### Usability
- Responsive design for desktop and tablet
- Keyboard shortcuts for common operations
- Consistent UI patterns across all tables
- Clear error messages with actionable guidance

---

## Tables & Attributes Reference

The following tables are included in the catalogue management system. Filterable and editable attributes will be specified in detailed requirements:

| Table Name | Description | Data Source |
|------------|-------------|-------------|
| Packages | Product package definitions | packages.xlsx |
| Entitlement Codes | RM entitlement code mappings | RM Entitlement Codes.xlsx |
| Products | Master product catalogue | Product_Catalogue.xlsx |

*Note: Specific filterable attributes for each table will be defined in Story 1.2 implementation details.*

---

## Technical Notes
- **Data Source**: PostgreSQL database with tables corresponding to the catalogue entities
- **API Framework**: RESTful API with OpenAPI/Swagger documentation
- **Authentication**: OAuth 2.0 / JWT tokens for API access
- **Environment Configuration**: Environment-specific connection strings and feature flags
- **Audit Trail**: All modifications logged with user, timestamp, and change details

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-11-03 | - | Initial user stories for search, filter, edit |
| 2.0 | 2024-12-10 | - | Expanded to include all 11 key outcomes: bulk operations, environment promotion, API support |
