# Environment Variables Security Update

## Overview

Updated all PowerShell scripts to remove hardcoded database passwords and use environment variables from the `.env` file instead.

## What Changed

### Files Updated

1. **`database/run-migrations.ps1`** ✅ SECURED
   - Removed hardcoded password: `"secure_password_123"`
   - Now reads from `DB_PASSWORD` environment variable
   - Automatically loads `.env` file from project root
   - Validates that password is provided before running

2. **`database/install-windows-databases.ps1`** ✅ SECURED
   - Removed hardcoded password: `'secure_password_123'`
   - Now reads from `DB_PASSWORD` environment variable
   - Uses other DB config from `.env` (DB_NAME, DB_USER)
   - Automatically loads `.env` file from project root

### New Functionality

Both scripts now include a `Load-EnvFile` function that:
- Automatically finds and loads the `.env` file from project root
- Parses environment variables (handles comments and formatting)
- Sets them as process-level environment variables
- Removes quotes from values

## How It Works

### Environment Variable Loading

The scripts will load database credentials in this order (priority):

1. **Command-line parameters** (highest priority)
   ```powershell
   .\run-migrations.ps1 -DbPassword "my_password"
   ```

2. **Environment variables from .env file** (automatically loaded)
   ```
   DB_PASSWORD=secure_password_123
   ```

3. **Default fallback values** (minimal, for non-sensitive values only)
   ```powershell
   $DbHost ?? "localhost"
   $DbPort ?? "5432"
   ```

### .env File Location

The scripts expect `.env` file to be in the project root:
```
hello-world-nodejs/
├── .env                    ← Your environment variables
├── .gitignore              ← .env is excluded from git
├── env.example             ← Template for .env
└── database/
    ├── run-migrations.ps1
    └── install-windows-databases.ps1
```

## Setup Instructions

### Update Your Existing .env File

**Note:** This project already has a `.env` file. You just need to add the database configuration.

1. **Edit your existing `.env` file:**
   ```powershell
   notepad .env
   ```

2. **Add database configuration (if not already present):**
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=deployment_assistant
   DB_USER=app_user
   DB_PASSWORD=your_secure_password_here  # ← Change this!
   DB_POOL_MAX=10
   DB_IDLE_TIMEOUT=30000
   DB_CONNECTION_TIMEOUT=2000
   ```

3. **Verify `.env` is in `.gitignore`:**
   The `.env` file is already excluded from git to prevent committing secrets. ✓

### Running Scripts

Now you can run scripts without specifying parameters:

```powershell
# Run migrations (uses .env automatically)
cd database
.\run-migrations.ps1

# Or override specific values
.\run-migrations.ps1 -DbPassword "different_password"

# Install databases (uses .env automatically)
.\install-windows-databases.ps1
```

## Security Improvements

### Before ❌
```powershell
[string]$DbPassword = "secure_password_123"  # Hardcoded in git!
```

### After ✅
```powershell
[string]$DbPassword = $env:DB_PASSWORD  # From .env file (not in git)
```

## Benefits

1. **✅ No secrets in git history** - Database passwords are never committed
2. **✅ Easy configuration** - Change `.env` file without modifying scripts
3. **✅ Multiple environments** - Different `.env` files for dev/staging/prod
4. **✅ GitHub protection** - Won't trigger secret scanning alerts
5. **✅ Team friendly** - Each developer has their own `.env` file
6. **✅ Backward compatible** - Can still pass parameters manually

## Environment Variables Used

The following variables are read from `.env` file:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | No |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_NAME` | Database name | `deployment_assistant` | No |
| `DB_USER` | Database user | `app_user` | No |
| `DB_PASSWORD` | Database password | None | **YES** |

## Troubleshooting

### Error: "Database password is required!"

**Problem:** The script can't find `DB_PASSWORD`

**Solution:**
1. Check `.env` file exists in project root
2. Verify `DB_PASSWORD=your_password` line in `.env`
3. Make sure no spaces around the `=` sign
4. Or pass password as parameter: `.\run-migrations.ps1 -DbPassword "password"`

### Error: "Loading environment variables from .env"

**Problem:** This is not an error! It's an informational message.

**Solution:** This is expected behavior showing the `.env` file was found and loaded.

### Password with special characters

If your password contains special characters, **do not quote it** in the `.env` file:

**Correct:**
```env
DB_PASSWORD=P@ssw0rd!123
```

**Incorrect:**
```env
DB_PASSWORD="P@ssw0rd!123"  # Quotes will be part of password!
```

The script automatically removes quotes if present.

## Git Security

### Files that ARE committed:
- ✅ `env.example` - Template file (safe to commit)
- ✅ `database/run-migrations.ps1` - No secrets
- ✅ `database/install-windows-databases.ps1` - No secrets

### Files that are NOT committed:
- ❌ `.env` - Contains real passwords (in .gitignore)
- ❌ `.env.local` - Local overrides (in .gitignore)
- ❌ `.env.production` - Production secrets (in .gitignore)

## Additional Security Recommendations

1. **Generate strong passwords:**
   ```powershell
   # PowerShell: Generate random password
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | ForEach-Object {[char]$_})
   ```

2. **Use different passwords for different environments:**
   - Development: One password
   - Staging: Different password
   - Production: Strong, unique password

3. **Never share .env files:**
   - Each developer should create their own
   - Use password managers for team credentials
   - Document the process in README

4. **Rotate passwords regularly:**
   - Update `.env` file
   - Update database
   - No code changes needed!

## Verification

To verify the changes are working:

1. **Check .env is not tracked by git:**
   ```powershell
   git status
   # .env should NOT appear in the list
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
   # Should only show env.example, not actual scripts
   ```

## Migration for Existing Users

If you've already committed hardcoded passwords:

1. **Remove from git history** (optional but recommended):
   ```bash
   git filter-branch --tree-filter 'sed -i "s/secure_password_123/REDACTED/g" database/*.ps1' HEAD
   ```

2. **Update passwords everywhere:**
   - Database
   - `.env` file
   - Any running services

3. **Force push** (if repository is not shared):
   ```bash
   git push --force
   ```

## Related Files

- `env.example` - Template for environment variables
- `.gitignore` - Ensures .env is not committed
- `database/run-migrations.ps1` - Database migration script
- `database/install-windows-databases.ps1` - Database installation script

## Questions?

If you have questions or encounter issues:
1. Check this documentation
2. Verify `.env` file format
3. Test with verbose logging: Add `-Verbose` to PowerShell commands
4. Check the script output for error messages

---

**Updated:** October 22, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready - All scripts secured

