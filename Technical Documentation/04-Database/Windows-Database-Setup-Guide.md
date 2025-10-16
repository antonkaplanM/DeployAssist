# Windows Database Setup Guide
## PostgreSQL and Redis Installation on Windows

**For**: Database Enhancement Initiative Phase 1  
**Platform**: Windows 10/11  
**Date**: September 26, 2025  

---

## 🎯 Quick Installation Summary

You need to install:
1. **PostgreSQL 14+** (Database server)
2. **Redis** (Cache server)
3. **Node.js packages** (Database drivers)

---

## 📦 Method 1: Using Windows Package Manager (Recommended)

### **Step 1: Install PostgreSQL**

```powershell
# Open PowerShell as Administrator and run:
winget install PostgreSQL.PostgreSQL
```

**What this does:**
- Installs PostgreSQL 15 (latest stable)
- Creates Windows service
- Installs pgAdmin (database management tool)
- Sets up default 'postgres' user

### **Step 2: Install Redis**

Redis doesn't have an official winget package, so we'll use the Microsoft-maintained version:

```powershell
# Download and install Redis for Windows
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.msi"
$redisInstaller = "$env:TEMP\Redis-x64-3.0.504.msi"

Invoke-WebRequest -Uri $redisUrl -OutFile $redisInstaller
Start-Process msiexec.exe -Wait -ArgumentList "/I $redisInstaller /quiet"
```

---

## 📦 Method 2: Manual Download Installation

### **PostgreSQL Manual Installation**

1. **Download PostgreSQL**:
   - Go to: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 14 or 15 installer
   - Choose 64-bit version

2. **Run Installer**:
   - Run as Administrator
   - **Important**: Remember the password you set for 'postgres' user
   - Install default components (PostgreSQL Server, pgAdmin, Command Line Tools)
   - Default port: 5432 (keep this)

3. **Verify Installation**:
   ```powershell
   # Test if PostgreSQL is working
   & "C:\Program Files\PostgreSQL\15\bin\psql.exe" --version
   ```

### **Redis Manual Installation**

1. **Download Redis**:
   - Go to: https://github.com/microsoftarchive/redis/releases
   - Download: `Redis-x64-3.0.504.msi`

2. **Install Redis**:
   - Run the MSI installer
   - Install to default location: `C:\Program Files\Redis`
   - Choose to install as Windows service

3. **Verify Installation**:
   ```powershell
   # Test if Redis is working
   & "C:\Program Files\Redis\redis-cli.exe" ping
   # Should return: PONG
   ```

---

## 🔧 Database Configuration

### **Step 1: Create Application Database**

```powershell
# Open Command Prompt or PowerShell and run:
cd "C:\Program Files\PostgreSQL\15\bin"

# Connect to PostgreSQL (enter password when prompted)
.\psql.exe -U postgres

# In the PostgreSQL prompt, run these commands:
CREATE DATABASE deployment_assistant;
CREATE USER app_user WITH PASSWORD 'secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE deployment_assistant TO app_user;

# Test the connection
\c deployment_assistant
\q
```

### **Step 2: Test Database Connection**

```powershell
# Test connecting with the app user
.\psql.exe -U app_user -d deployment_assistant
# Enter password: secure_password_123
# If successful, you'll see: deployment_assistant=>
\q
```

### **Step 3: Start Services**

```powershell
# Start PostgreSQL service (if not already running)
Start-Service postgresql*

# Start Redis service
Start-Service Redis
```

---

## 📝 Environment Configuration

Update your `.env` file with these database settings:

```env
# Database Configuration
DATABASE_URL=postgresql://app_user:secure_password_123@localhost:5432/deployment_assistant
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deployment_assistant
DB_USER=app_user
DB_PASSWORD=secure_password_123

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache Configuration
CACHE_TTL_SECONDS=900
CACHE_ENABLED=true
BACKGROUND_SYNC_INTERVAL=300000

# Keep your existing Salesforce/JIRA settings...
```

---

## 📦 Install Node.js Database Packages

```bash
# Navigate to your project directory
cd C:\Users\kaplana\source\repos\DeployAssist

# Install required database packages
npm install pg @types/pg pg-pool redis @types/redis db-migrate db-migrate-pg knex uuid @types/uuid

# Verify installation
npm list --depth=0 | findstr "pg\|redis"
```

---

## ✅ Verification Tests

### **Test PostgreSQL Connection**

```javascript
// Create a test file: test-db-connection.js
const { Pool } = require('pg');

const pool = new Pool({
    user: 'app_user',
    host: 'localhost',
    database: 'deployment_assistant',
    password: 'secure_password_123',
    port: 5432,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ PostgreSQL connection failed:', err);
    } else {
        console.log('✅ PostgreSQL connected:', res.rows[0]);
    }
    pool.end();
});
```

### **Test Redis Connection**

```javascript
// Add to test file:
const redis = require('redis');
const client = redis.createClient({
    host: 'localhost',
    port: 6379
});

client.on('connect', () => {
    console.log('✅ Redis connected successfully');
    client.quit();
});

client.on('error', (err) => {
    console.error('❌ Redis connection failed:', err);
});

client.connect();
```

### **Run Test**

```bash
node test-db-connection.js
```

**Expected Output:**
```
✅ PostgreSQL connected: { now: 2025-09-26T18:00:00.000Z }
✅ Redis connected successfully
```

---

## 🔧 Troubleshooting

### **PostgreSQL Issues**

**Problem**: `psql: error: connection to server on socket`  
**Solution**: 
```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*
# If stopped, start it:
Start-Service postgresql*
```

**Problem**: `password authentication failed`  
**Solution**: Reset PostgreSQL password or use correct password set during installation

**Problem**: `database "deployment_assistant" does not exist`  
**Solution**: Create the database using the SQL commands above

### **Redis Issues**

**Problem**: `Could not connect to Redis`  
**Solution**:
```powershell
# Check Redis service
Get-Service Redis
# Start if stopped
Start-Service Redis

# Or start manually:
& "C:\Program Files\Redis\redis-server.exe"
```

**Problem**: `Redis not found`  
**Solution**: Add Redis to PATH or use full path to redis-cli.exe

### **Node.js Package Issues**

**Problem**: `Cannot find module 'pg'`  
**Solution**:
```bash
npm install --save pg @types/pg
```

**Problem**: `node-gyp rebuild failed`  
**Solution**: Install Visual Studio Build Tools:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

---

## 📊 Service Management

### **Start Services Automatically**

```powershell
# Set PostgreSQL to start automatically
Set-Service -Name postgresql* -StartupType Automatic

# Set Redis to start automatically  
Set-Service -Name Redis -StartupType Automatic
```

### **Check Service Status**

```powershell
# Check both services
Get-Service postgresql*, Redis | Format-Table Name, Status, StartType
```

---

## 🎯 Next Steps After Installation

1. ✅ **Verify both databases are running**
2. ✅ **Install Node.js packages** 
3. ✅ **Update .env configuration**
4. ✅ **Run connection tests**
5. 🚀 **Begin Phase 1 implementation**

---

## 📞 Quick Reference

| Service | Default Port | Management Tool | Start Command |
|---------|-------------|-----------------|---------------|
| PostgreSQL | 5432 | pgAdmin 4 | `Start-Service postgresql*` |
| Redis | 6379 | redis-cli | `Start-Service Redis` |

**Database URLs:**
- PostgreSQL: `postgresql://app_user:secure_password_123@localhost:5432/deployment_assistant`
- Redis: `redis://localhost:6379`

This completes the Windows database setup! You're now ready to proceed with Phase 1 of the database enhancement initiative.



