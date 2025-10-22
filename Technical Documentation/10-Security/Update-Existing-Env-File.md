# Update Your Existing .env File

## ⚠️ Important Note

This project **already has a `.env` file**. You don't need to create a new one!

You just need to **add the database configuration** to your existing `.env` file.

---

## Quick Steps

### 1. Open Your Existing .env File
```powershell
notepad .env
```

### 2. Add These Lines (if not already present)

Add the following database configuration to your existing `.env` file:

```env
# ===== Database Configuration (PostgreSQL) =====
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deployment_assistant
DB_USER=app_user
DB_PASSWORD=your_secure_password_here  # ← CHANGE THIS!
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

**Important:** Replace `your_secure_password_here` with your actual database password!

### 3. Save and Close

That's it! The scripts will automatically load these values.

---

## What Your .env File Should Look Like

Your `.env` file should have sections like this:

```env
# ===== Application Configuration =====
NODE_ENV=development
PORT=8080
LOG_LEVEL=info

# ===== Database Configuration (PostgreSQL) =====
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deployment_assistant
DB_USER=app_user
DB_PASSWORD=your_actual_password_123  # Your real password
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# ===== Salesforce Configuration =====
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_client_id_here
# ... other config ...

# ===== Authentication Configuration =====
JWT_SECRET=your_jwt_secret_here
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_this_password
# ... other config ...
```

---

## Verify Your Configuration

### Check if DB_PASSWORD is Set

```powershell
# View your .env file
Get-Content .env | Select-String "DB_PASSWORD"
```

Should show:
```
DB_PASSWORD=your_actual_password
```

### Test the Scripts

```powershell
# Test migration script
cd database
.\run-migrations.ps1
```

If you see "Database password is required!", then `DB_PASSWORD` is not set in your `.env` file.

---

## Common Issues

### Issue: "Database password is required!"

**Cause:** `DB_PASSWORD` is not in your `.env` file or is commented out.

**Solution:**
```powershell
# Open .env
notepad .env

# Add this line (uncommented):
DB_PASSWORD=your_password

# Make sure there's no # at the start of the line!
```

### Issue: Scripts can't find .env file

**Cause:** Running from wrong directory.

**Solution:**
```powershell
# Always run from project root or database folder
cd C:\Users\kaplana\source\repos\hello-world-nodejs
.\database\run-migrations.ps1

# OR from database folder
cd database
.\run-migrations.ps1
```

### Issue: Password has special characters

**In .env file (no quotes needed):**
```env
DB_PASSWORD=P@ssw0rd!123$pecial
```

**NOT:**
```env
DB_PASSWORD="P@ssw0rd!123$pecial"  # ❌ Quotes become part of password
```

---

## Reference: env.example

If you need to see what variables are available, check `env.example`:

```powershell
Get-Content env.example
```

This shows all available configuration options with descriptions.

---

## Security Reminder

✅ Your `.env` file is **already in `.gitignore`**  
✅ It will **never be committed** to git  
✅ Each developer should have their **own `.env` file**  
✅ Never share your `.env` file or commit it to version control

---

## Need Help?

1. Check that `.env` exists: `Test-Path .env` (should return True)
2. View database config: `Get-Content .env | Select-String "DB_"`
3. Verify gitignore: `Get-Content .gitignore | Select-String ".env"` (should show .env is ignored)
4. Test scripts: `.\database\run-migrations.ps1 -DbPassword "test"` (override to test)

---

**Updated:** October 22, 2025  
**For Project:** hello-world-nodejs  
**Action Required:** Add `DB_*` variables to your existing `.env` file

