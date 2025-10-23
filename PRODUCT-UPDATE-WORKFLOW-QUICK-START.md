# Product Update Workflow - Quick Start Guide

## 🚀 What's New?

You can now create product entitlement update requests directly from the Customer Products page! This new workflow allows you to:

- ✅ Add new product entitlements
- ✅ Remove existing entitlements
- ✅ Track pending requests
- ✅ Manage requests with status updates

---

## 📋 Setup Instructions

### ✅ Migration Already Complete!

Good news! The database migration has already been run successfully:

- ✅ **3 tables created:** `product_update_options`, `product_update_requests`, `product_update_request_history`
- ✅ **623 options extracted:** 37 packages, 577 products (452 models, 107 data, 18 apps), 4 regions, 5 modifiers
- ✅ **Functions and triggers active**

**You can skip to step 1 below and start using it immediately!**

---

### 1. Start the Application

```bash
# Start backend
npm start

# Start frontend (in another terminal)
cd frontend
npm run dev
```

---

## 🎯 How to Use

### Create a Product Update Request

1. **Navigate to Customer Products**
   - Go to Customer Products page from sidebar
   - Search for a customer account

2. **Click "Product Update" Button**
   - Green button in the account summary section
   - Next to "View History" button

3. **Make Changes in the Modal**
   - Switch between tabs: Models, Data, Apps
   - **To Add Entitlements:**
     - Click "Add Entitlement"
     - Select product from dropdown
     - Select package
     - Set quantity and dates
     - Click elsewhere to save
   - **To Remove Entitlements:**
     - Click "Remove" next to any current entitlement
     - Item will be highlighted in red
     - Click "Undo Remove" to cancel

4. **Set Priority & Add Notes (Optional)**
   - Choose priority: Low, Normal, High, Urgent
   - Add any notes about the request

5. **Submit Request**
   - Click "Submit Request"
   - Request number (PUR-XXXXX) will be generated
   - You'll be redirected to Pending Requests page

### View Pending Requests

1. **Navigate to Pending Requests**
   - Sidebar: Customer Products > Pending Requests
   - Or click "Pending Requests" button on Customer Products page

2. **Filter Requests**
   - Filter by status (Pending, Approved, etc.)
   - Filter by account name
   - Click "Refresh" to reload

3. **Manage Requests**
   - ✅ Approve: Click green checkmark
   - ❌ Reject: Click red X
   - 🗑️ Delete: Click trash icon
   - Click account name to view products

---

## 🗂️ Navigation Updates

The sidebar now shows:

```
📦 Customer Products
   ├── Product Entitlements
   └── Pending Requests (NEW!)
```

---

## 🔍 Testing the Workflow

### Test Checklist

1. ✅ **Database Setup**
   ```sql
   -- Verify tables exist
   \dt product_update*
   
   -- Should show:
   -- product_update_options
   -- product_update_requests
   -- product_update_request_history
   ```

2. ✅ **Options Available**
   ```sql
   -- Check options
   SELECT option_type, COUNT(*) FROM product_update_options GROUP BY option_type;
   
   -- Should show packages, modifiers, regions, products
   ```

3. ✅ **Create Request**
   - Search for a customer with products
   - Click "Product Update"
   - Add 1 new entitlement in Models tab
   - Remove 1 existing entitlement in Data tab
   - Submit with Normal priority
   - Verify request appears in Pending Requests

4. ✅ **View Request**
   - Go to Pending Requests page
   - See your request in the table
   - Verify change summary shows "+1 added, -1 removed"

5. ✅ **Update Status**
   - Click approve (green checkmark)
   - Verify status changes to "Approved"
   - Refresh and confirm change persisted

---

## 📊 Database Schema Quick Reference

### Main Tables

**product_update_options**
- Stores dropdown options (packages, products, modifiers, regions)
- Auto-populated from PS audit trail

**product_update_requests**
- Stores all product update requests
- Request number format: PUR-00001, PUR-00002, etc.
- Status: pending → approved/rejected → processing → completed/failed

**product_update_request_history**
- Automatic audit trail of status changes
- Triggered on every status update

### Key Functions

- `generate_request_number()` - Auto-generates PUR-XXXXX
- `refresh_product_options()` - Extracts options from PS records
- Automatic triggers for timestamps and history

---

## 🎨 UI Components

### ProductUpdateModal
- **Location:** `frontend/src/components/features/ProductUpdateModal.jsx`
- **Features:**
  - Tabbed interface (Models, Data, Apps)
  - Add/remove entitlements
  - Form validation
  - Change counter
  - Priority selection

### PendingProductRequests
- **Location:** `frontend/src/pages/PendingProductRequests.jsx`
- **Features:**
  - Filterable table
  - Quick actions (approve, reject, delete)
  - Status badges
  - Change summaries
  - Navigation to customer products

---

## 🔧 API Endpoints

Base URL: `http://localhost:3001/api/product-update`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/options` | GET | Get all dropdown options |
| `/options?type=package` | GET | Get specific options |
| `/options/refresh` | POST | Refresh from PS audit trail |
| `/requests` | GET | Get all pending requests |
| `/requests` | POST | Create new request |
| `/requests/:id` | GET | Get specific request |
| `/requests/:id/status` | PATCH | Update status |
| `/requests/:id` | DELETE | Delete request |
| `/requests/:id/history` | GET | Get status history |

---

## 🐛 Troubleshooting

### Modal Won't Open
**Issue:** Nothing happens when clicking "Product Update"

**Solutions:**
- Check browser console for errors
- Verify customer data is loaded (modal requires `data` state)
- Check authentication (must be logged in)

### Options Dropdowns Empty
**Issue:** Product/Package dropdowns show no options

**Solutions:**
- Run `refresh_product_options()` function
- Check PS audit trail has completed records
- Verify API endpoint returns data: `GET /api/product-update/options`

### Request Not Saving
**Issue:** Submit button doesn't work or shows error

**Solutions:**
- Check all required fields are filled (marked with red *)
- Verify backend is running and database is connected
- Check browser console and backend logs for errors
- Ensure at least one change (add/remove) is made

### Pending Requests Empty
**Issue:** No requests showing on Pending Requests page

**Solutions:**
- Check status filter (change to "All Statuses")
- Clear account name filter
- Verify request was created: `SELECT * FROM product_update_requests`
- Check page permissions (requires `customer_products` access)

---

## 📈 Next Steps

### Immediate
1. ✅ ~~Run database migration~~ **DONE!**
2. ✅ ~~Populate options~~ **DONE! (623 options ready)**
3. ✅ Test creating a request
4. ✅ Test pending requests page

### Future Enhancements
- Salesforce integration (auto-create PS records)
- Email notifications
- Approval workflows
- Request templates
- Bulk operations
- Advanced reporting

---

## 📞 Support

For detailed documentation, see:
- **Full Documentation:** `Technical Documentation/03-Features/Product-Update-Workflow-Feature.md`
- **Database Schema:** `database/init-scripts/11-product-update-workflow.sql`
- **API Service:** `product-update-service.js`

---

## 🎉 Summary

You now have a complete product update workflow that:

1. ✅ Allows users to request product entitlement changes
2. ✅ Provides an intuitive tabbed interface
3. ✅ Tracks all changes and status updates
4. ✅ Integrates seamlessly with existing Customer Products page
5. ✅ Stores all data in PostgreSQL with audit trail
6. ✅ Offers filtering and management of pending requests

**Start using it now!** 🚀

Navigate to Customer Products, search for a customer, and click "Product Update" to begin!

