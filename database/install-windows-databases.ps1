# PostgreSQL and Redis Installation Script for Windows
# Run this script as Administrator

Write-Host "🚀 Installing PostgreSQL and Redis on Windows..." -ForegroundColor Green

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
    $env:PGPASSWORD = "postgres"
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "CREATE DATABASE deployment_assistant;"
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "CREATE USER app_user WITH PASSWORD 'secure_password_123';"
    & "C:\Program Files\PostgreSQL\*\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE deployment_assistant TO app_user;"
    
    Write-Host "✅ PostgreSQL configuration completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ PostgreSQL configuration needs manual setup" -ForegroundColor Yellow
    Write-Host "Please run these commands manually after installation:" -ForegroundColor Cyan
    Write-Host "psql -U postgres -c `"CREATE DATABASE deployment_assistant;`"" -ForegroundColor Gray
    Write-Host "psql -U postgres -c `"CREATE USER app_user WITH PASSWORD 'secure_password_123';`"" -ForegroundColor Gray
    Write-Host "psql -U postgres -c `"GRANT ALL PRIVILEGES ON DATABASE deployment_assistant TO app_user;`"" -ForegroundColor Gray
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
