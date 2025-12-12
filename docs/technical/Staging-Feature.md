# Staging Page - Experimental PoC Feature

**Status:** ✅ Implementation Complete  
**Date:** December 11, 2025  
**Location:** Experimental Pages Section  
**Route:** `/experimental/staging`

---

## 📋 Overview

The Staging page is a proof-of-concept feature that provides a staging area where PS (Professional Services) records are displayed before they are processed by downstream systems. This allows users to review, edit, and approve or reject provisioning requests in a controlled environment.

## 🎯 Purpose

- **Pre-Processing Review**: Review PS records before they are sent to downstream systems
- **Data Validation**: Inspect and validate payload data in a human-readable format
- **Temporary Editing**: Make temporary edits to payload attributes for testing purposes
- **Quality Control**: Confirm or reject records based on review

## 🏗️ Architecture

### Frontend Components

1. **`frontend/src/pages/Staging.jsx`**
   - Main staging page component
   - Displays table of random PS records
   - Handles confirm/reject actions
   - Manages record replacement

2. **`frontend/src/components/features/StagingPayloadModal.jsx`**
   - Modal for displaying parsed JSON payload
   - Provides editing interface for product attributes
   - Validates user input
   - Visual feedback for edited fields

3. **`frontend/src/components/features/RawDataModal.jsx`**
   - Modal for displaying raw JSON data
   - Syntax highlighting
   - Copy to clipboard functionality

4. **`frontend/src/services/stagingService.js`**
   - API service layer
   - Handles communication with backend
   - Fetches random records and replacements

### Backend Components

1. **`routes/staging.routes.js`**
   - API endpoints for staging functionality
   - `/api/staging/random-records` - Fetch random PS records
   - `/api/staging/record/:id` - Fetch single record by ID

### Database

1. **`database/add-staging-page.sql`**
   - Migration script to add page permissions
   - Creates `experimental.staging` page entry
   - Assigns permissions to admin and user roles

---

## 🔧 Setup Instructions

### 1. Database Migration

Run the SQL migration to add the Staging page to the database:

```bash
# Using psql (adjust path if needed)
psql -U postgres -d deployassist -f database/add-staging-page.sql

# OR on Windows (adjust PostgreSQL path as needed):
Get-Content database/add-staging-page.sql | & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d deployassist
```

### 2. Verify Backend is Running

Ensure the backend server is running with the staging routes mounted:

```bash
npm start
```

Check that you see: `✅ All extracted route modules mounted successfully`

### 3. Access the Page

Navigate to: `http://localhost:8080/experimental/staging`

---

## 📊 Features

### Table View

The staging page displays a table with the following columns:

| Column | Description |
|--------|-------------|
| **PS Record** | PS record number and request type |
| **Deploy Number** | Associated deployment number |
| **Account Name** | Customer account name and site |
| **Products** | Product entitlements badges (Models, Data, Apps) |
| **Payload** | Link to view parsed JSON with edit capability |
| **Raw Data** | Link to view complete raw JSON |
| **Actions** | Confirm/Reject buttons |

### Key Behaviors

#### 1. **Random Sampling**
- Displays 10 random PS records from the live database
- Records are selected randomly on each page load
- Same records can appear multiple times (no permanent exclusion)

#### 2. **Confirm Action**
- Marks record as confirmed
- Removes from staging view
- Replaces with new random record
- Increments "Confirmed" counter
- Smooth fade-out/fade-in animation

#### 3. **Reject Action**
- Marks record as rejected
- Removes from staging view
- Replaces with new random record
- Increments "Rejected" counter
- Discards any unsaved edits (with warning)
- Smooth fade-out/fade-in animation

#### 4. **Refresh All**
- Reloads all 10 sample records with new random selections
- Resets confirmed/rejected counters
- Clears all temporary edits
- Requires user confirmation

### Payload Modal

#### View Mode
- Displays parsed JSON in organized sections:
  - 📊 Model Entitlements
  - 💾 Data Entitlements
  - 📱 App Entitlements
- Shows product count for each category
- Color-coded sections for easy identification

#### Edit Mode
- Click "Edit" button to enable editing
- Editable fields highlighted with amber border
- Shows "edited" badge on modified fields
- Real-time validation with error messages
- Save/Cancel actions with unsaved changes warning

### Editable Fields

#### Model Entitlements
- ✅ Product Code
- ✅ Product Modifier
- ✅ Start Date
- ✅ End Date

#### Data Entitlements
- ❌ Product Code (read-only)
- ✅ Product Modifier
- ✅ Start Date
- ✅ End Date

#### App Entitlements
- ✅ Product Code
- ✅ Product Modifier
- ✅ Start Date
- ✅ End Date
- ✅ Package Name
- ✅ Quantity
- ✅ Licensed Transactions
- ✅ Consumption Multiplier

### Validation Rules

The system validates user input in real-time:

1. **Date Validation**
   - Start date must be before end date
   - Displays error message if invalid

2. **Product Code**
   - Required for Models and Apps
   - Cannot be empty

3. **Numeric Fields** (Apps only)
   - Quantity: Must be non-negative integer
   - Licensed Transactions: Must be non-negative integer
   - Consumption Multiplier: Must be non-negative number

4. **Visual Feedback**
   - Invalid fields highlighted in red
   - Error messages displayed below field
   - Cannot save until all validations pass

### Raw Data Modal

- Displays complete raw JSON payload
- Dark theme for better readability
- Copy to clipboard button
- Scrollable for large payloads

---

## 🎨 Visual Design

### Color Coding

- **Models**: Blue badges and sections
- **Data**: Green badges and sections  
- **Apps**: Purple badges and sections
- **Edited Fields**: Amber highlighting
- **Errors**: Red highlighting
- **Success Actions**: Green (Confirm)
- **Destructive Actions**: Red (Reject)

### Animations

- **Record Replacement**: Smooth fade-out/fade-in transition (300ms)
- **Processing State**: Loading spinner on action buttons
- **Hover Effects**: Subtle background color changes
- **Modal Transitions**: Standard slide-in/fade animations

### Accessibility

- Proper ARIA labels on modals
- Keyboard navigation support
- Focus management
- Clear visual indicators for all states
- Tooltips on action buttons

---

## 💾 Data Handling

### Temporary Edits

**Important:** All edits are temporary and stored in-memory only!

- Edits are stored in React state (`editedPayloads`)
- Not persisted to database
- Lost when record is confirmed/rejected
- Lost when page is refreshed
- Lost when "Refresh All" is clicked

### Edit Lifecycle

1. User opens Payload modal
2. Clicks "Edit" button
3. Makes changes to fields
4. Clicks "Save Changes"
5. Changes applied to local state
6. Visual indicator shows "edited" status
7. **Edits remain until:**
   - Record is confirmed (edits lost)
   - Record is rejected (edits lost with warning)
   - Page is refreshed
   - "Refresh All" is clicked

---

## 🔌 API Endpoints

### GET `/api/staging/random-records`

Fetch random PS records for staging review.

**Query Parameters:**
- `count` (number, default: 10): Number of records to fetch
- `exclude` (string, optional): Comma-separated list of record IDs to exclude

**Response:**
```json
{
  "success": true,
  "records": [
    {
      "Id": "a1DUW000002Tf8H2AS",
      "Name": "PS-5024",
      "Account__c": "SiriusPoint Ltd.",
      "Deployment__r": { "Name": "Deploy-7672" },
      "parsedPayload": {
        "models": [...],
        "data": [...],
        "apps": [...]
      }
    }
  ],
  "totalAvailable": 4062,
  "timestamp": "2025-12-11T17:00:00.000Z"
}
```

### GET `/api/staging/record/:id`

Fetch a single PS record by ID.

**Response:**
```json
{
  "success": true,
  "record": {
    "Id": "a1DUW000002Tf8H2AS",
    "Name": "PS-5024",
    "parsedPayload": {...}
  }
}
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Page loads with 10 random records
- [ ] All table columns display correctly
- [ ] Products column shows correct badges
- [ ] "View Payload" opens modal with parsed data
- [ ] "View Raw" opens modal with raw JSON
- [ ] "Edit" button enables editing mode
- [ ] Edited fields show amber highlighting
- [ ] "edited" badges appear on modified fields
- [ ] Validation errors display for invalid input
- [ ] Cannot save with validation errors
- [ ] "Save Changes" applies edits successfully
- [ ] "Cancel" discards changes (with warning if unsaved)
- [ ] "Confirm" replaces record smoothly
- [ ] "Reject" replaces record (with warning if edited)
- [ ] Stats counters increment correctly
- [ ] "Refresh All" reloads all samples
- [ ] Animations are smooth and professional
- [ ] Dark mode works correctly
- [ ] No console errors

### Edge Cases

- [ ] Empty payload data
- [ ] Missing deployment number
- [ ] No entitlements in payload
- [ ] Very large payloads (100+ products)
- [ ] Invalid date formats
- [ ] Negative numbers in quantity fields
- [ ] Empty product codes
- [ ] Network errors during record fetch

---

## 🚀 Usage Guide

### For End Users

1. **Navigate to Staging Page**
   - Click "Experimental Pages" in sidebar
   - Click "Staging" submenu item

2. **Review Records**
   - Browse the table of 10 sample PS records
   - Check account names, products, and deployment numbers

3. **View Payload Data**
   - Click "View Payload" to see parsed JSON
   - Review model, data, and app entitlements
   - Click "Edit" to modify attributes
   - Make changes and click "Save Changes"

4. **View Raw JSON**
   - Click "View Raw" to see complete payload
   - Use "Copy" button to copy to clipboard

5. **Process Records**
   - Click "Confirm" to accept a record (replaces with new one)
   - Click "Reject" to decline a record (replaces with new one)
   - Watch stats counter update

6. **Refresh Samples**
   - Click "Refresh All Samples" to reload all records
   - Confirms before clearing current samples

---

## ⚠️ Important Notes

### Proof of Concept

This is a **proof-of-concept** implementation with the following limitations:

1. **No Persistence**: Edits are NOT saved to database
2. **Test Data Only**: Uses random samples from live data
3. **No Audit Trail**: Actions (confirm/reject) are not logged
4. **In-Memory Only**: All state lost on page refresh
5. **No Downstream Integration**: Does not actually send to processing systems

### Use Cases

Ideal for:
- ✅ Testing payload structure
- ✅ Validating data formats
- ✅ Training users on data review
- ✅ Understanding PS record structure
- ✅ Demonstrating staging workflow

Not suitable for:
- ❌ Production data processing
- ❌ Permanent data modifications
- ❌ Audit-required workflows
- ❌ Critical business processes

---

## 🔄 Future Enhancements

Potential improvements for production version:

1. **Database Persistence**
   - Save edited payloads to staging table
   - Track confirmation/rejection history
   - Maintain audit trail

2. **Workflow Integration**
   - Send confirmed records to downstream systems
   - Queue rejected records for review
   - Email notifications on actions

3. **Advanced Filtering**
   - Filter by account, request type, status
   - Search functionality
   - Date range selection

4. **Bulk Actions**
   - Select multiple records
   - Bulk confirm/reject
   - Batch export

5. **Validation Engine Integration**
   - Show validation status in table
   - Prevent confirmation of invalid records
   - Detailed validation error display

6. **Role-Based Actions**
   - Different actions for different roles
   - Approval workflow
   - Manager override capabilities

---

## 🐛 Troubleshooting

### Page Not Appearing in Sidebar

1. Ensure database migration was run:
   ```sql
   SELECT * FROM pages WHERE name = 'experimental.staging';
   ```

2. Check user permissions:
   ```sql
   SELECT u.username, p.name, p.display_name
   FROM users u
   JOIN role_pages rp ON rp.role_id = u.role_id
   JOIN pages p ON p.id = rp.page_id
   WHERE u.username = 'your_username' AND p.name = 'experimental.staging';
   ```

3. Clear browser cache and reload

### Records Not Loading

1. Check Salesforce connection:
   - Navigate to Settings > Salesforce Configuration
   - Test connection

2. Check browser console for errors

3. Verify backend is running on port 5000

4. Check API endpoint: `http://localhost:5000/api/staging/random-records?count=10`

### Edits Not Saving

This is expected behavior! Edits are **temporary only** and not persisted to the database. This is a PoC feature designed to demonstrate the workflow without modifying actual data.

### Modal Not Opening

1. Check browser console for React errors
2. Verify modal components are imported correctly
3. Check for CSS conflicts with dark mode

---

## 📝 Technical Details

### State Management

The component uses React hooks for state management:

```javascript
// Record list
const [records, setRecords] = useState([]);

// Temporary edits (in-memory only)
const [editedPayloads, setEditedPayloads] = useState({});

// Processing states
const [processingRecords, setProcessingRecords] = useState(new Set());
const [replacingRecords, setReplacingRecords] = useState(new Set());

// Statistics
const [stats, setStats] = useState({ confirmed: 0, rejected: 0 });
```

### Record Replacement Flow

```
1. User clicks Confirm/Reject
2. Record ID added to processingRecords Set
3. API call to fetch replacement record
4. New record replaces old in state array
5. Stats counter incremented
6. Edited payload removed from memory
7. Fade transition applied (300ms)
8. Record ID removed from processingRecords
```

### Validation Logic

```javascript
// Date validation
if (startDate >= endDate) {
  error: 'Start date must be before end date'
}

// Required fields
if (!productCode || productCode.trim() === '') {
  error: 'Product code is required'
}

// Numeric validation
if (isNaN(quantity) || quantity < 0) {
  error: 'Quantity must be a non-negative number'
}
```

---

## 🎨 UI Components Used

### Heroicons
- `CheckCircleIcon` - Confirm action
- `XCircleIcon` - Reject action
- `DocumentTextIcon` - Payload view
- `CodeBracketIcon` - Raw data view
- `PencilIcon` - Edit mode
- `ArrowPathIcon` - Refresh action
- `ExclamationTriangleIcon` - Unsaved changes warning

### Tailwind CSS Classes
- Gradient backgrounds for headers
- Color-coded product badges
- Smooth transitions and animations
- Responsive grid layouts
- Dark mode support throughout

---

## 🔐 Security & Permissions

### Access Control
- Requires authentication (protected route)
- Available to users with `experimental.staging` permission
- Admin and User roles have access by default

### Data Safety
- Read-only access to Salesforce data
- No write operations to database
- Edits stored in browser memory only
- No audit trail of actions (PoC only)

---

## 📈 Performance Considerations

### Optimization Strategies

1. **Random Sampling**
   - Fetches 50 records, randomly selects 10
   - Prevents loading entire dataset
   - Fast query performance

2. **Lazy Loading**
   - Modals render only when opened
   - Raw JSON parsed on-demand

3. **State Updates**
   - Efficient Set operations for processing states
   - Minimal re-renders with targeted state updates

4. **Animation Performance**
   - CSS transitions (GPU-accelerated)
   - Debounced user interactions

---

## 📚 Related Documentation

- [Provisioning Monitor](./Provisioning-Monitor-Feature.md) - Similar table implementation
- [Product Modal](./Product-Modal-Component.md) - Modal pattern reference
- [API Reference](./API-REFERENCE.md) - Complete API documentation
- [Experimental Pages Guide](./Experimental-Pages-Guide.md) - Section overview

---

## 🔗 Integration Points

### Depends On
- Salesforce connection (for fetching PS records)
- Authentication system (for access control)
- Pages/permissions database tables

### Used By
- None (standalone PoC feature)

### Could Integrate With
- Validation engine (show validation status)
- SML comparison (compare against SML data)
- Notification system (alerts on actions)

---

## 📞 Support

### Common Questions

**Q: Where is the data stored?**  
A: Data is fetched from Salesforce in real-time. Edits are stored in browser memory only.

**Q: Can I add or delete products?**  
A: No, you can only edit attributes of existing products in this PoC.

**Q: What happens to confirmed records?**  
A: They are removed from the UI and replaced with a new random record. No other action is taken.

**Q: Can I recover rejected records?**  
A: No, once rejected they are removed from the staging view. You may see them again in a future random sample.

**Q: Why aren't my edits saving?**  
A: This is expected! All edits are temporary for this PoC and intentionally not persisted.

---

## ✅ Implementation Checklist

- [x] Backend API routes created
- [x] Frontend service layer implemented
- [x] Staging page component created
- [x] Payload modal with edit capability
- [x] Raw data modal created
- [x] Routing configured
- [x] Sidebar navigation updated
- [x] Database migration script created
- [x] Documentation written
- [x] Visual indicators for edited fields
- [x] Validation rules implemented
- [x] Confirm/Reject actions working
- [x] Record replacement logic
- [x] Stats tracking
- [x] Refresh all functionality
- [x] Dark mode support
- [x] Responsive design

---

**Last Updated:** December 11, 2025  
**Status:** ✅ Ready for Use  
**Version:** 1.0.0 (PoC)


