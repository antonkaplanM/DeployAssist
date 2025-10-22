# Environment Variables Security Guide

## Overview

This guide covers the security improvements made to protect database credentials and other sensitive configuration using environment variables.

## Security Update (October 22, 2025)

All hardcoded database passwords have been removed from scripts and replaced with environment variables loaded from the `.env` file.

---

## What Was Fixed

### Files Secured

1. **`database/run-migrations.ps1`** ✅
   - Removed hardcoded password: `"secure_password_123"`
   - Now reads from: `$env:DB_PASSWORD`
   - Auto-loads `.env` file from project root
   - Validates password is provided

2. **`database/install-windows-databases.ps1`** ✅
   - Removed hardcoded passwords from psql commands
   - Now uses: `$env:DB_PASSWORD`
   - Auto-loads `.env` file

3. **`database.js`** ✅
   - Removed fallback: `|| 'secure_password_123'`
   - Now requires: `process.env.DB_PASSWORD`

---

## Configuration

### Update Your Existing .env File

Your project already has a `.env` file. Add these database configuration lines if not present:

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

---

## How It Works

### Environment Variable Loading

Scripts load database credentials in this priority order:

1. **Command-line parameters** (highest priority)
   ```powershell
   .\run-migrations.ps1 -DbPassword "my_password"
   ```

2. **Environment variables from .env file** (automatically loaded)
   ```env
   DB_PASSWORD=secure_password_123
   ```

3. **System environment variables**
   ```powershell
   $env:DB_PASSWORD = "password"
   ```

4. **Default values** (non-sensitive only, like localhost)

### Auto-Load Function

Both PowerShell scripts include a `Load-EnvFile` function that:
- Automatically finds `.env` in project root
- Parses environment variables
- Sets them as process-level environment variables
- Removes quotes from values
- Handles comments properly

---

## Usage

### Running Scripts

```powershell
# Run migrations (uses .env automatically)
cd database
.\run-migrations.ps1

# Or override specific values
.\run-migrations.ps1 -DbPassword "different_password"

# Install databases (uses .env automatically)
.\install-windows-databases.ps1
```

---

## Security Benefits

1. ✅ **No secrets in git** - Database passwords never committed
2. ✅ **Easy configuration** - Change `.env` without modifying scripts
3. ✅ **Multiple environments** - Different `.env` files for dev/staging/prod
4. ✅ **GitHub safe** - Won't trigger secret scanning alerts
5. ✅ **Team friendly** - Each developer has their own `.env` file
6. ✅ **Backward compatible** - Can still pass parameters manually

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | No |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_NAME` | Database name | `deployment_assistant` | No |
| `DB_USER` | Database user | `app_user` | No |
| `DB_PASSWORD` | Database password | None | **YES** |

---

## Troubleshooting

### Error: "Database password is required!"

**Solution:**
1. Open your existing `.env` file in project root
2. Add or verify `DB_PASSWORD=your_password` line
3. Make sure no spaces around the `=` sign
4. Or pass password as parameter: `.\run-migrations.ps1 -DbPassword "password"`

### Password with Special Characters

**In .env file (no quotes):**
```env
DB_PASSWORD=P@ssw0rd!123$pecial
```

**In command line (use quotes):**
```powershell
.\run-migrations.ps1 -DbPassword 'P@ssw0rd!123$pecial'
```

---

## Git Security

### Files in Git (Safe to Commit):
- ✅ `env.example` - Template file
- ✅ `database/run-migrations.ps1` - No secrets
- ✅ `database/install-windows-databases.ps1` - No secrets
- ✅ `database.js` - No secrets

### Files NOT in Git (Protected):
- ❌ `.env` - Contains real passwords (in .gitignore)
- ❌ `.env.local` - Local overrides (in .gitignore)
- ❌ `.env.production` - Production secrets (in .gitignore)

---

## Additional Security Recommendations

1. **Generate strong passwords:**
   ```powershell
   # PowerShell: Generate random password
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object {[char]$_})
   ```

2. **Use different passwords per environment:**
   - Development: One password
   - Staging: Different password
   - Production: Strong, unique password

3. **Never share .env files:**
   - Each developer creates their own
   - Use password managers for team credentials
   - Document the process in README

4. **Rotate passwords regularly:**
   - Update `.env` file
   - Update database
   - No code changes needed!

---

## Verification

To verify security:

1. **Check .env is not tracked by git:**
   ```powershell
   git status
   # .env should NOT appear
   ```

2. **Test running migration script:**
   ```powershell
   cd database
   .\run-migrations.ps1
   # Should load .env and run successfully
   ```

3. **Verify no hardcoded secrets in git:**
   ```powershell
   git grep -i "secure_password"
   # Should only show env.example
   ```

---

## Related Documentation

- [Security Advisory](../02-Architecture/SECURITY-ADVISORY.md) - General security guidelines
- [Windows Database Setup](../04-Database/Windows-Database-Setup-Guide.md) - Database installation

---

**Last Updated:** October 22, 2025  
**Status:** ✅ Production Ready - All scripts secured

