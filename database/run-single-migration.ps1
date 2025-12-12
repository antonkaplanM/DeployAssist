# Run a single SQL migration file
# Usage: .\run-single-migration.ps1 -SqlFile "add-staging-page.sql"

param(
    [Parameter(Mandatory=$true)]
    [string]$SqlFile,
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $env:DB_PORT,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USER,
    [string]$DbPassword = $env:DB_PASSWORD
)

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
    } else {
        Write-Host "⚠️  .env file not found at: $EnvFilePath" -ForegroundColor Yellow
    }
}

# Load .env file from project root
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
Load-EnvFile -EnvFilePath $envFile

# Set defaults if still not set
if (-not $DbHost) { $DbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" } }
if (-not $DbPort) { $DbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" } }
if (-not $DbName) { $DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "deployassist" } }
if (-not $DbUser) { $DbUser = if ($env:DB_USER) { $env:DB_USER } else { "postgres" } }
if (-not $DbPassword) { $DbPassword = $env:DB_PASSWORD }

# Validate SQL file exists
$sqlFilePath = Join-Path $PSScriptRoot $SqlFile
if (-not (Test-Path $sqlFilePath)) {
    Write-Host "❌ SQL file not found: $sqlFilePath" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Running database migration..." -ForegroundColor Green
Write-Host "File: $SqlFile" -ForegroundColor Cyan
Write-Host "Database: $DbName on ${DbHost}:${DbPort}" -ForegroundColor Cyan
Write-Host "User: $DbUser" -ForegroundColor Cyan

# Set PostgreSQL password environment variable if provided
if ($DbPassword) {
    $env:PGPASSWORD = $DbPassword
} else {
    Write-Host "⚠️  No password provided - psql will prompt for password" -ForegroundColor Yellow
}

# Find PostgreSQL installation
$pgPath = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue | 
    Sort-Object Name -Descending | 
    Select-Object -First 1

if ($null -eq $pgPath) {
    Write-Host "❌ PostgreSQL not found in C:\Program Files\PostgreSQL" -ForegroundColor Red
    Write-Host "Checking alternative locations..." -ForegroundColor Yellow
    
    # Try other common locations
    $altPaths = @(
        "C:\PostgreSQL",
        "C:\Program Files (x86)\PostgreSQL"
    )
    
    foreach ($altPath in $altPaths) {
        if (Test-Path $altPath) {
            $pgPath = Get-ChildItem -Path $altPath -Directory -ErrorAction SilentlyContinue | 
                Sort-Object Name -Descending | 
                Select-Object -First 1
            if ($pgPath) {
                Write-Host "Found PostgreSQL at: $altPath" -ForegroundColor Green
                break
            }
        }
    }
    
    if ($null -eq $pgPath) {
        Write-Host "❌ PostgreSQL installation not found" -ForegroundColor Red
        Write-Host "Please install PostgreSQL or add psql.exe to your PATH" -ForegroundColor Yellow
        exit 1
    }
}

$psqlPath = Join-Path $pgPath.FullName "bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    Write-Host "❌ psql.exe not found at: $psqlPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found psql at: $psqlPath" -ForegroundColor Gray
Write-Host ""

# Execute the SQL file
try {
    Write-Host "📄 Executing SQL file..." -ForegroundColor Yellow
    
    $output = & $psqlPath -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $sqlFilePath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        
        # Show output
        if ($output) {
            Write-Host ""
            Write-Host "Output:" -ForegroundColor Cyan
            $output | ForEach-Object { 
                if ($_ -match "ERROR") {
                    Write-Host "   $_" -ForegroundColor Red
                } elseif ($_ -match "WARNING") {
                    Write-Host "   $_" -ForegroundColor Yellow
                } else {
                    Write-Host "   $_" -ForegroundColor Gray
                }
            }
        }
        
        exit 0
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed!" -ForegroundColor Red
        Write-Host "Error details:" -ForegroundColor Red
        $output | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Exception occurred:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}


