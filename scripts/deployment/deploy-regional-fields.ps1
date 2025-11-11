#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Regional and Bundle Fields Update
.DESCRIPTION
    This script automates the deployment of the regional and bundle fields update:
    1. Tests Salesforce field accessibility (optional)
    2. Runs database migration
    3. Syncs products from Salesforce
.PARAMETER SkipTest
    Skip the Salesforce field accessibility test
.EXAMPLE
    .\deploy-regional-fields.ps1
.EXAMPLE
    .\deploy-regional-fields.ps1 -SkipTest
#>

param(
    [switch]$SkipTest
)

Write-Host "Regional and Bundle Fields Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js found: $(node --version)" -ForegroundColor Green
Write-Host ""

# Step 1: Test Salesforce field accessibility (optional)
if (-not $SkipTest) {
    Write-Host "Step 1/3: Testing Salesforce field accessibility..." -ForegroundColor Yellow
    Write-Host "-----------------------------------------------------" -ForegroundColor Yellow
    
    $testProcess = Start-Process -FilePath "node" -ArgumentList "test-regional-fields.js" -NoNewWindow -PassThru -Wait
    
    if ($testProcess.ExitCode -ne 0) {
        Write-Host ""
        Write-Host "Salesforce field test failed!" -ForegroundColor Red
        Write-Host "   This could mean the fields are not accessible or do not exist." -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Do you want to continue anyway? (y/N)"
        if (-not ($continue -match "^[yY]$")) {
            Write-Host "Deployment cancelled." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Salesforce fields are accessible!" -ForegroundColor Green
    }
    Write-Host ""
} else {
    Write-Host "Skipping Salesforce field test (use without -SkipTest to enable)" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Run database migration
Write-Host "Step 2/3: Running database migration..." -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

$migrationProcess = Start-Process -FilePath "node" -ArgumentList "run-regional-fields-migration.js" -NoNewWindow -PassThru -Wait

if ($migrationProcess.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Database migration failed!" -ForegroundColor Red
    Write-Host "   Please check the error messages above." -ForegroundColor Red
    Write-Host "   You may need to check your database connection settings." -ForegroundColor Yellow
    exit 1
}

Write-Host "Database migration completed!" -ForegroundColor Green
Write-Host ""

# Step 3: Sync products from Salesforce
Write-Host "Step 3/3: Syncing products from Salesforce..." -ForegroundColor Yellow
Write-Host "-------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

$syncProcess = Start-Process -FilePath "node" -ArgumentList "sync-products-from-salesforce.js" -NoNewWindow -PassThru -Wait

if ($syncProcess.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Product sync failed!" -ForegroundColor Red
    Write-Host "   Please check the error messages above." -ForegroundColor Red
    Write-Host "   The database migration was successful, so you can retry the sync." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "   Database schema updated with new columns" -ForegroundColor Green
Write-Host "   Products synced from Salesforce" -ForegroundColor Green
Write-Host "   New fields now available in API responses" -ForegroundColor Green
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Write-Host "   You can verify the update by:" -ForegroundColor White
Write-Host "   1. Checking the database for the new columns" -ForegroundColor White
Write-Host "   2. Querying a product via API: /api/product-catalogue" -ForegroundColor White
Write-Host "   3. Exporting to Excel and checking the Attributes column" -ForegroundColor White
Write-Host ""
Write-Host "New fields available:" -ForegroundColor Cyan
Write-Host "   - Continent__c" -ForegroundColor White
Write-Host "   - IRP_Bundle_Region__c (CRITICAL)" -ForegroundColor White
Write-Host "   - IRP_Bundle_Subregion__c (CRITICAL)" -ForegroundColor White
Write-Host ""
Write-Host "For more details, see: REGIONAL-FIELDS-UPDATE-SUMMARY.md" -ForegroundColor Gray
Write-Host ""
