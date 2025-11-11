# Product Update Workflow Feature

## Overview

The Product Update Workflow is a comprehensive feature that allows users to create product entitlement update requests directly from the Customer Products page. This streamlines the process of modifying customer product entitlements by providing an intuitive interface for adding, removing, or modifying product entitlements across three categories: Models, Data, and Apps.

**Status:** ✅ Complete  
**Date:** October 2025  
**Author:** AI Assistant

---

## User Workflow

### 1. Navigate to Customer Products Page

Users start by navigating to the Customer Products page and searching for a customer account.

### 2. Initiate Product Update

Once a customer is loaded, users can click the **"Product Update"** button to launch the Product Update Modal.

### 3. Product Update Modal

The modal displays:
- Current entitlements organized by category (Models, Data, Apps)
- Tabs for switching between categories
- Interface for adding new entitlements
- Interface for removing existing entitlements

**Key Features:**
- **Add Entitlements:** Create new product entitlement lines with:
  - Product selection from dropdown (populated from PS records)
  - Package selection
  - Quantity
  - Product modifier
  - Start and end dates
  
- **Remove Entitlements:** Mark existing entitlements for removal by clicking the "Remove" button

- **Tab Navigation:** Switch between Models, Data, and Apps categories to manage each independently

- **Validation:** Required fields are validated before submission

### 4. Submit Request

After making changes across any or all categories, users can:
- Set request priority (Low, Normal, High, Urgent)
- Add optional notes
- Submit the request

The system generates a unique request number (PUR-XXXXX format) and saves the request as "pending".

### 5. View Pending Requests

Users can view all pending product update requests on the **Pending Product Requests** page, accessible via:
- The sidebar navigation under "Customer Products > Pending Requests"
- The "Pending Requests" button on the Customer Products page

---

## Technical Architecture

### Database Schema

#### Tables

**1. `product_update_options`**
- Stores dropdown options for the modal (packages, products, modifiers, regions)
- Populated from PS audit trail data
- Schema:
  ```sql
  - id (serial)
  - option_type (varchar): 'package', 'product', 'modifier', 'region'
  - option_value (varchar)
  - option_label (varchar)
  - category (varchar): 'models', 'data', 'apps', or NULL
  - metadata (jsonb): Additional data
  - is_active (boolean)
  - created_at, updated_at (timestamps)
  ```

**2. `product_update_requests`**
- Stores all product update requests
- Schema:
  ```sql
  - id (serial)
  - request_number (varchar): Unique PUR-XXXXX format
  - account_name (varchar)
  - account_id (varchar)
  - requested_by (varchar): Username
  - request_status (varchar): pending, approved, rejected, processing, completed, failed
  - priority (varchar): low, normal, high, urgent
  - request_type (varchar): add, remove, modify
  - region (varchar)
  - changes_requested (jsonb): {models: {added, removed, modified}, data: {...}, apps: {...}}
  - request_notes (text)
  - approval_notes (text)
  - ps_record_id, ps_record_name (varchar): Once PS record is created
  - error_message (text)
  - timestamps: created_at, updated_at, submitted_at, approved_at, completed_at
  ```

**3. `product_update_request_history`**
- Tracks status changes for audit trail
- Automatically updated via trigger

#### Functions

- `generate_request_number()`: Generates unique PUR-XXXXX numbers
- `refresh_product_options()`: Extracts options from PS audit trail
- `update_updated_at_column()`: Automatic timestamp updates
- `track_request_status_change()`: Logs status changes to history table

#### Views

- `pending_product_updates`: Convenient view of pending/active requests with change counts

---

## Backend Implementation

### Service: `product-update-service.js`

**Key Functions:**
- `getAllProductOptions()`: Fetches all dropdown options
- `getProductOptions(type, category)`: Fetches specific options
- `createProductUpdateRequest(requestData)`: Creates new request
- `getPendingProductUpdateRequests(filters)`: Gets pending requests with optional filters
- `getProductUpdateRequest(identifier)`: Gets specific request by ID or number
- `updateProductUpdateRequestStatus(identifier, status, updateData)`: Updates request status
- `deleteProductUpdateRequest(identifier)`: Deletes a request
- `getProductUpdateRequestHistory(identifier)`: Gets status change history
- `refreshProductOptions()`: Refreshes options from PS audit trail

### API Endpoints

**Base Path:** `/api/product-update`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/options` | Get product update options (all or filtered) |
| POST | `/options/refresh` | Refresh options from PS audit trail |
| POST | `/requests` | Create new product update request |
| GET | `/requests` | Get pending requests (with optional filters) |
| GET | `/requests/:identifier` | Get specific request |
| PATCH | `/requests/:identifier/status` | Update request status |
| DELETE | `/requests/:identifier` | Delete request |
| GET | `/requests/:identifier/history` | Get request history |

---

## Frontend Implementation

### Components

**1. `ProductUpdateModal.jsx`**
- Main modal component for creating product update requests
- Features:
  - Tabbed interface for Models, Data, Apps
  - Current entitlements display
  - Add/remove entitlement functionality
  - Form validation
  - Priority and notes fields
  - Change counter

**Props:**
- `isOpen`: Boolean to control visibility
- `onClose`: Callback to close modal
- `accountName`: Current account name
- `currentProducts`: Current product entitlements by region
- `onRequestCreated`: Callback after successful creation

**2. `PendingProductRequests.jsx`**
- Page component for viewing and managing pending requests
- Features:
  - Filterable table (by status, account)
  - Quick status actions (approve, reject)
  - Delete requests
  - Navigate to customer products
  - Refresh data
  - Change summary display

### Services

**`productUpdateService.js`**
- API client for all product update endpoints
- Error handling and type-safe responses

### Routing

**New Routes:**
- `/pending-product-requests` - Pending requests page

**Updated Navigation:**
- Customer Products section now has submenu:
  - Product Entitlements
  - Pending Requests

---

## Integration Points

### Customer Products Page

**Added Features:**
- "Product Update" button (green) - Opens modal
- "Pending Requests" button (gray) - Navigates to pending requests page
- ProductUpdateModal integration

**Button Location:** In the account summary section, next to "View History" button

### Sidebar Navigation

**Updated Structure:**
```
Customer Products
├── Product Entitlements (/customer-products)
└── Pending Requests (/pending-product-requests)
```

---

## Data Flow

### Creating a Request

1. User clicks "Product Update" on Customer Products page
2. Modal opens, fetches dropdown options from `/api/product-update/options`
3. User makes changes (add/remove entitlements) across categories
4. User sets priority and adds notes
5. User clicks "Submit Request"
6. Frontend validates required fields
7. POST to `/api/product-update/requests` with:
   ```json
   {
     "accountName": "Customer Name",
     "requestedBy": "username",
     "priority": "normal",
     "requestType": "modify",
     "notes": "Optional notes",
     "changes": {
       "models": {
         "added": [...],
         "removed": [...],
         "modified": []
       },
       "data": {...},
       "apps": {...}
     }
   }
   ```
8. Backend generates PUR-XXXXX number, stores request
9. Status history entry created automatically
10. Success response returns request object
11. Frontend navigates to pending requests page

### Viewing Pending Requests

1. User navigates to Pending Requests page
2. GET `/api/product-update/requests` with optional filters
3. Backend queries database with filters
4. Returns formatted request list with change summaries
5. Frontend displays in table with:
   - Request number
   - Account (clickable to view products)
   - Change summary (# added, # removed)
   - Priority badge
   - Status badge
   - Quick actions

### Managing Requests

**Approve/Reject:**
- PATCH `/api/product-update/requests/:identifier/status`
- Updates status and timestamps
- Triggers history entry

**Delete:**
- DELETE `/api/product-update/requests/:identifier`
- Cascades to history table

---

## Configuration

### Database Migration

Run the migration to create tables:
```bash
node database/run-single-migration.js 11-product-update-workflow.sql
```

### Populate Options

To populate dropdown options from existing PS records:
```javascript
// Call the refresh endpoint
POST /api/product-update/options/refresh
```

Or run database function directly:
```sql
SELECT * FROM refresh_product_options();
```

---

## Testing Checklist

- [ ] Database tables created successfully
- [ ] Options populated from PS audit trail
- [ ] Modal opens from Customer Products page
- [ ] Current entitlements display correctly
- [ ] Can add new entitlements with all fields
- [ ] Can remove existing entitlements
- [ ] Tab navigation works between categories
- [ ] Change counter updates correctly
- [ ] Form validation prevents submission with missing fields
- [ ] Request creates successfully with unique PUR number
- [ ] Request appears in Pending Requests table
- [ ] Filters work (status, account)
- [ ] Quick actions work (approve, reject, delete)
- [ ] Status history tracks changes
- [ ] Navigation between pages works
- [ ] Sidebar submenu displays correctly
- [ ] Permissions check (customer_products page)

---

## Future Enhancements

### Phase 2 (Potential)

1. **Salesforce Integration**
   - Automatically create PS records from approved requests
   - Sync status back from Salesforce
   - Attach generated PS record to request

2. **Advanced Features**
   - Request templates for common scenarios
   - Bulk operations across multiple accounts
   - Request cloning/duplication
   - Email notifications on status changes
   - Approval workflow with multiple approvers
   - Comments/discussion thread per request

3. **Reporting**
   - Request volume metrics
   - Approval time analytics
   - Most requested products
   - User activity tracking

4. **Product Modification**
   - Support for modifying existing entitlements (dates, quantities)
   - Compare before/after states
   - Validation rules based on business logic

5. **Enhanced UX**
   - Drag-and-drop for organizing entitlements
   - Preview of changes before submission
   - Conflict detection (overlapping dates, duplicates)
   - Smart suggestions based on history

---

## API Documentation

### Request Object Structure

```typescript
interface ProductUpdateRequest {
  id: number;
  requestNumber: string;        // PUR-00001
  accountName: string;
  accountId?: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requestType: 'add' | 'remove' | 'modify';
  region?: string;
  changes: {
    models: CategoryChanges;
    data: CategoryChanges;
    apps: CategoryChanges;
  };
  notes?: string;
  approvalNotes?: string;
  psRecordId?: string;
  psRecordName?: string;
  errorMessage?: string;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

interface CategoryChanges {
  added: Entitlement[];
  removed: Entitlement[];
  modified: Entitlement[];
}

interface Entitlement {
  productCode: string;
  productName: string;
  packageName: string;
  quantity?: number;
  productModifier?: string;
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
}
```

---

## Troubleshooting

### Options Not Populating

**Issue:** Dropdown options are empty in modal

**Solution:**
1. Check PS audit trail has data: `SELECT COUNT(*) FROM ps_audit_trail WHERE status = 'Tenant Request Completed'`
2. Run refresh function: `SELECT * FROM refresh_product_options()`
3. Verify options exist: `SELECT * FROM product_update_options`
4. Check API: `GET /api/product-update/options`

### Request Creation Fails

**Issue:** Error when submitting request

**Solutions:**
- Check required fields are filled (productCode, packageName, startDate, endDate)
- Verify user is authenticated (requestedBy is set)
- Check backend logs for validation errors
- Ensure accountName matches exactly

### Pending Requests Not Showing

**Issue:** Requests table is empty

**Solutions:**
- Check filters (status filter may exclude your requests)
- Verify requests exist: `SELECT * FROM product_update_requests`
- Check page entitlements (customer_products access required)
- Clear filters and refresh

---

## Maintenance

### Periodic Tasks

**Refresh Product Options (Recommended: Weekly)**
```bash
# Via API
curl -X POST http://localhost:3001/api/product-update/options/refresh

# Or via SQL
psql -U app_user -d deployment_assistant -c "SELECT * FROM refresh_product_options()"
```

**Clean Up Old Requests (Optional)**
```sql
-- Delete completed requests older than 90 days
DELETE FROM product_update_requests 
WHERE request_status = 'completed' 
AND completed_at < NOW() - INTERVAL '90 days';
```

**Archive Old History (Optional)**
```sql
-- Archive history for requests older than 1 year
-- Implementation depends on archival strategy
```

---

## Performance Considerations

### Database Indexes

The following indexes are automatically created:
- `product_update_options`: option_type, category, is_active
- `product_update_requests`: account_name, request_status, requested_by, created_at, request_number
- `product_update_request_history`: request_id, created_at

### Optimization Tips

1. **Options Refresh**: Run during off-peak hours as it queries entire PS audit trail
2. **Request Queries**: Use filters to reduce result set size
3. **History Table**: Consider archival strategy for old entries
4. **Modal Loading**: Options are cached in memory during modal session

---

## Security & Permissions

### Access Control

- Requires `customer_products` page entitlement for all features
- No additional role-based restrictions in v1
- Request ownership tracked but not enforced

### Data Validation

- Server-side validation of all required fields
- SQL injection protection via parameterized queries
- XSS prevention via React's built-in escaping

### Audit Trail

- All status changes logged in `product_update_request_history`
- Automatic triggers ensure history integrity
- Cannot be bypassed by direct status updates

---

## Support & Contact

For issues or questions about the Product Update Workflow:

1. Check this documentation
2. Review Technical Documentation in `/Technical Documentation/`
3. Check application logs for errors
4. Verify database connectivity and data integrity

---

## Changelog

### v1.0.0 - October 2025
- Initial release
- Product update modal with tabbed interface
- Add/remove entitlements functionality
- Pending requests management page
- Status tracking and history
- Database schema and migrations
- API endpoints for full CRUD operations
- Integration with Customer Products page
- Sidebar navigation updates

---

## Files Modified/Created

### Database
- ✅ `database/init-scripts/11-product-update-workflow.sql` - New schema

### Backend
- ✅ `product-update-service.js` - New service
- ✅ `app.js` - Added API endpoints

### Frontend
- ✅ `frontend/src/services/productUpdateService.js` - New API client
- ✅ `frontend/src/components/features/ProductUpdateModal.jsx` - New modal component
- ✅ `frontend/src/pages/PendingProductRequests.jsx` - New page
- ✅ `frontend/src/pages/CustomerProducts.jsx` - Updated with modal integration
- ✅ `frontend/src/App.jsx` - Added route
- ✅ `frontend/src/components/layout/Sidebar.jsx` - Updated navigation

### Documentation
- ✅ `Technical Documentation/03-Features/Product-Update-Workflow-Feature.md` - This file

---

**End of Documentation**

