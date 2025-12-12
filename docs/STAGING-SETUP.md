# Staging Feature - Quick Setup Guide

**🎉 Database Migration Status: COMPLETE ✅**

This guide will help you set up the new Staging page feature. The database migration has been successfully completed, and the page is ready to use!

## 🚀 Quick Start

### Step 1: Run Database Migration ✅ **COMPLETED**

**Good news!** The database migration has been successfully completed. The Staging page is now set up with:

- ✅ Page entry created: `experimental.staging`
- ✅ Route configured: `/experimental/staging`
- ✅ Permissions assigned to: admin, user roles
- ✅ Parent page linked: Experimental Pages

**Verification results:**
```
Page Name:       experimental.staging
Display Name:    Staging
Route:          /experimental/staging
Permissions:    admin, user
Sort Order:     3 (after Roadmap and Product Catalogue)
```

If you need to run this migration again in the future or on another environment, use:

#### Option A: Using the Helper Script (Recommended)

```powershell
cd database
.\run-single-migration.ps1 -SqlFile "add-staging-page.sql"
```

This script automatically:
- Loads environment variables from `.env`
- Finds your PostgreSQL installation
- Connects using the configured credentials
- Runs the migration with error handling

#### Option B: Verify Current Setup

To verify the page is properly configured:

```powershell
cd database
.\run-single-migration.ps1 -SqlFile "verify-staging-page.sql"
```

#### Option C: Manual SQL Execution

If you prefer manual execution:

1. Open pgAdmin or your preferred PostgreSQL client
2. Connect to the `deployment_assistant` database
3. Open `database/add-staging-page.sql`
4. Execute the script

### Step 2: Verify Database Migration ✅ **VERIFIED**

The database has been verified successfully with these results:

```
name                  | display_name | route
----------------------|--------------|--------------------
experimental.staging  | Staging      | /experimental/staging

Permissions:
- admin role: ✅ Has access
- user role:  ✅ Has access

Parent Page: Experimental Pages (experimental)
Sort Order: 3
```

If you want to re-verify at any time:

```powershell
cd database
.\run-single-migration.ps1 -SqlFile "verify-staging-page.sql"
```

### Step 3: Restart Backend Server

If your backend is running, restart it to ensure all routes are loaded:

```bash
# Stop the server (Ctrl+C)
# Then start it again
npm start
```

Look for this message:
```
✅ All extracted route modules mounted successfully
```

### Step 4: Access the Page

1. Open your browser to `http://localhost:8080`
2. Log in to the application
3. Click **"Experimental Pages"** in the sidebar
4. Click **"Staging"** in the submenu
5. You should see the Staging page with 10 random PS records

## ✅ Verification Checklist

- [ ] Database migration ran without errors
- [ ] `experimental.staging` page exists in database
- [ ] Backend server restarted successfully
- [ ] "Staging" link appears in sidebar under "Experimental Pages"
- [ ] Staging page loads with 10 records
- [ ] No console errors in browser
- [ ] "View Payload" opens modal
- [ ] "Edit" button works in modal
- [ ] "Confirm" and "Reject" buttons replace records

## 🐛 Troubleshooting

### "Staging" link doesn't appear in sidebar

**Problem:** The database migration didn't run or permissions weren't assigned.

**Solution:**
1. Verify the page exists:
   ```sql
   SELECT * FROM pages WHERE name = 'experimental.staging';
   ```

2. If not found, run the migration script again

3. Check your user has permission:
   ```sql
   SELECT u.username, p.name, p.display_name
   FROM users u
   JOIN role_pages rp ON rp.role_id = u.role_id
   JOIN pages p ON p.id = rp.page_id
   WHERE u.username = 'YOUR_USERNAME' AND p.name = 'experimental.staging';
   ```

4. If no permission found, manually add it:
   ```sql
   INSERT INTO role_pages (role_id, page_id)
   SELECT r.id, p.id
   FROM roles r
   CROSS JOIN pages p
   WHERE r.name = 'user' AND p.name = 'experimental.staging'
   ON CONFLICT DO NOTHING;
   ```

5. Log out and log back in

### Page loads but no records appear

**Problem:** Salesforce connection issue or no PS records in database.

**Solution:**
1. Check Salesforce connection in Settings
2. Test the API endpoint directly:
   ```
   http://localhost:5000/api/staging/random-records?count=10
   ```
3. Check browser console for errors
4. Verify backend is running on port 5000

### "View Payload" button doesn't work

**Problem:** Modal component issue or payload data missing.

**Solution:**
1. Check browser console for React errors
2. Verify the record has `Payload_Data__c` field populated
3. Check that modal components were installed correctly
4. Clear browser cache and reload

### Edits not saving

**This is expected!** Edits are temporary only and not persisted to the database. This is a proof-of-concept feature.

## 📚 Next Steps

Once setup is complete:

1. **Read the full documentation**: `docs/technical/Staging-Feature.md`
2. **Review the summary**: `docs/summaries/Staging-Feature-Summary.md`
3. **Test the features**:
   - View payload data
   - Edit product attributes
   - Confirm/reject records
   - Refresh all samples

## 🎯 Key Points to Remember

- ✅ All edits are **temporary** and stored in browser memory only
- ✅ Confirmed/rejected records are replaced with new random ones
- ✅ This is a **PoC** feature for demonstration purposes
- ✅ No data is written back to Salesforce or the database
- ✅ Same records can reappear in random samples

## 💡 Tips

- Use "View Payload" to see parsed, human-readable JSON
- Use "View Raw" to see the complete raw JSON payload
- Click "Edit" to enable editing mode in the payload modal
- Look for amber highlighting on edited fields
- Validation happens in real-time as you type
- You can't save invalid data (errors shown in red)

---

**Need Help?** Check the full documentation at `docs/technical/Staging-Feature.md`

**Questions?** The feature is ready to use once the database migration is complete!

