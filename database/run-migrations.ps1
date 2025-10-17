# Database Migration Script
# Runs all SQL initialization scripts in order

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "deployment_assistant",
    [string]$DbUser = "app_user",
    [string]$DbPassword = "secure_password_123"
)

Write-Host "🚀 Running database migrations..." -ForegroundColor Green
Write-Host "Database: $DbName on ${DbHost}:${DbPort}" -ForegroundColor Cyan

# Set PostgreSQL password environment variable
$env:PGPASSWORD = $DbPassword

# Get the PostgreSQL bin path
$pgPath = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue | 
    Sort-Object Name -Descending | 
    Select-Object -First 1

if ($null -eq $pgPath) {
    Write-Host "❌ PostgreSQL not found in C:\Program Files\PostgreSQL" -ForegroundColor Red
    Write-Host "Please install PostgreSQL or specify the correct path" -ForegroundColor Yellow
    exit 1
}

$psqlPath = Join-Path $pgPath.FullName "bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    Write-Host "❌ psql.exe not found at: $psqlPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found psql at: $psqlPath" -ForegroundColor Gray

# Get all SQL files in order
$sqlFiles = Get-ChildItem -Path ".\init-scripts\*.sql" | Sort-Object Name

if ($sqlFiles.Count -eq 0) {
    Write-Host "❌ No SQL files found in .\init-scripts\" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($sqlFiles.Count) SQL files to execute" -ForegroundColor Cyan

# Execute each SQL file
$successCount = 0
$errorCount = 0

foreach ($file in $sqlFiles) {
    Write-Host "`n📄 Executing: $($file.Name)..." -ForegroundColor Yellow
    
    try {
        $output = & $psqlPath -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $file.FullName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully executed: $($file.Name)" -ForegroundColor Green
            $successCount++
            
            # Show any notices or messages
            if ($output) {
                $output | ForEach-Object {
                    if ($_ -match "NOTICE") {
                        Write-Host "   $_" -ForegroundColor Gray
                    }
                }
            }
        } else {
            Write-Host "❌ Error executing: $($file.Name)" -ForegroundColor Red
            Write-Host "Error details:" -ForegroundColor Red
            $output | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
            $errorCount++
        }
    } catch {
        Write-Host "❌ Exception executing: $($file.Name)" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

# Summary
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "Migration Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "  ❌ Failed: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host ("="*60) -ForegroundColor Cyan

if ($errorCount -eq 0) {
    Write-Host "`n🎉 All migrations completed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Some migrations failed. Please check the errors above." -ForegroundColor Yellow
    exit 1
}

