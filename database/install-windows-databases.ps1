# PostgreSQL and Redis Installation Script for Windows
# Run this script as Administrator

# Function to load .env file
function Load-EnvFile {
    param([string]$EnvFilePath = ".env")
    
    if (Test-Path $EnvFilePath) {
        Write-Host "📄 Loading environment variables from $EnvFilePath" -ForegroundColor Gray
        Get-Content $EnvFilePath | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                # Remove quotes if present
                $value = $value -replace '^["'']|["'']$', ''
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
}

# Load .env file from project root (go up one directory from database folder)
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
Load-EnvFile -EnvFilePath $envFile

# Get database configuration from environment variables
$DB_NAME = $env:DB_NAME
$DB_USER = $env:DB_USER
$DB_PASSWORD = $env:DB_PASSWORD
$POSTGRES_PASSWORD = $env:POSTGRES_PASSWORD

# Validate required environment variables
if (-not $DB_NAME -or -not $DB_USER -or -not $DB_PASSWORD -or -not $POSTGRES_PASSWORD) {
    Write-Host "❌ ERROR: Missing required environment variables in .env file" -ForegroundColor Red
    Write-Host "Please ensure your .env file contains:" -ForegroundColor Yellow
    Write-Host "   DB_NAME=deployment_assistant" -ForegroundColor Gray
    Write-Host "   DB_USER=app_user" -ForegroundColor Gray
    Write-Host "   DB_PASSWORD=your_password" -ForegroundColor Gray
    Write-Host "   POSTGRES_PASSWORD=your_postgres_password" -ForegroundColor Gray
    exit 1
}

Write-Host "🚀 Installing PostgreSQL and Redis on Windows..." -ForegroundColor Green
Write-Host "Using configuration from .env file:" -ForegroundColor Cyan
Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
Write-Host "   User: $DB_USER" -ForegroundColor Gray
Write-Host "   Admin User: postgres" -ForegroundColor Gray

# Install PostgreSQL using winget
Write-Host "📊 Installing PostgreSQL..." -ForegroundColor Yellow
try {
    winget install PostgreSQL.PostgreSQL
    Write-Host "✅ PostgreSQL installation completed" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL installation failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Install Redis (Windows version)
Write-Host "⚡ Installing Redis..." -ForegroundColor Yellow
try {
    # Redis for Windows (Microsoft maintained)
    winget install Microsoft.VCRedist.2015+.x64
    Invoke-WebRequest -Uri "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.msi" -OutFile "$env:TEMP\Redis-x64-3.0.504.msi"
    Start-Process msiexec.exe -Wait -ArgumentList "/I $env:TEMP\Redis-x64-3.0.504.msi /quiet"
    Write-Host "✅ Redis installation completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Redis installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 You can download Redis manually from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Cyan
}

# Configure PostgreSQL
Write-Host "🔧 Configuring PostgreSQL..." -ForegroundColor Yellow
try {
    # Start PostgreSQL service
    Start-Service postgresql*
    
    # Wait for service to start
    Start-Sleep -Seconds 5
    
    # Create database and user using psql
    # Use password from environment variable (loaded from .env file)
    $env:PGPASSWORD = $POSTGRES_PASSWORD
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "CREATE DATABASE $DB_NAME;"
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    Write-Host "✅ PostgreSQL configuration completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ PostgreSQL configuration needs manual setup" -ForegroundColor Yellow
    Write-Host "Please run these commands manually after installation:" -ForegroundColor Cyan
    Write-Host "psql -U postgres -c `"CREATE DATABASE $DB_NAME;`"" -ForegroundColor Gray
    Write-Host "psql -U postgres -c `"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';`"" -ForegroundColor Gray
    Write-Host "psql -U postgres -c `"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;`"" -ForegroundColor Gray
}

# Configure Redis
Write-Host "🔧 Configuring Redis..." -ForegroundColor Yellow
try {
    # Start Redis service (if installed as service)
    Start-Service Redis -ErrorAction SilentlyContinue
    Write-Host "✅ Redis service started" -ForegroundColor Green
} catch {
    Write-Host "💡 Redis might need to be started manually" -ForegroundColor Cyan
    Write-Host "You can start Redis from: C:\Program Files\Redis\redis-server.exe" -ForegroundColor Gray
}

Write-Host "🎉 Database installation completed!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Install Node.js database packages: npm install pg redis db-migrate" -ForegroundColor Gray
Write-Host "2. Update your .env file with database connection details" -ForegroundColor Gray
Write-Host "3. Test the database connections" -ForegroundColor Gray



