# Setup Windows Task Scheduler for SML Validation Processing
# This script creates a scheduled task that runs the process-sml-validation.js script every 10 minutes

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Configuration
$TaskName = "SML-Validation-Processing"
$ScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "process-sml-validation.js"
$NodePath = "C:\Program Files\nodejs\node.exe"

# Check if Node.js exists
if (-not (Test-Path $NodePath)) {
    Write-Host "ERROR: Node.js not found at: $NodePath" -ForegroundColor Red
    Write-Host "Please install Node.js or update the NodePath variable in this script" -ForegroundColor Yellow
    exit 1
}

# Check if script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERROR: Script not found at: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SML Validation Processing - Task Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "WARNING: Task '$TaskName' already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove and recreate it? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Existing task removed" -ForegroundColor Green
    } else {
        Write-Host "Setup cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Create task action (run node script)
Write-Host "Creating task action..." -ForegroundColor Cyan
$Action = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $PSScriptRoot

# Create trigger (every 10 minutes)
Write-Host "Creating trigger (every 10 minutes)..." -ForegroundColor Cyan
$Trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 10)

# Create task settings
Write-Host "Configuring task settings..." -ForegroundColor Cyan
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew

# Create task principal (run as current user)
Write-Host "Setting task principal (current user)..." -ForegroundColor Cyan
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

# Register the task
Write-Host "Registering scheduled task..." -ForegroundColor Cyan
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Processes SML validation for deprovision PS records every 10 minutes" `
        -ErrorAction Stop | Out-Null
    
    Write-Host "Task created successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to create task: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name:      $TaskName" -ForegroundColor White
Write-Host "  Frequency: Every 10 minutes" -ForegroundColor White
Write-Host "  Script:    $ScriptPath" -ForegroundColor White
Write-Host "  Node.js:   $NodePath" -ForegroundColor White
Write-Host ""

# Get task info
$Task = Get-ScheduledTask -TaskName $TaskName
$TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host "Current Status:" -ForegroundColor Cyan
Write-Host "  State:        $($Task.State)" -ForegroundColor White
Write-Host "  Last Run:     $($TaskInfo.LastRunTime)" -ForegroundColor White
Write-Host "  Next Run:     $($TaskInfo.NextRunTime)" -ForegroundColor White
Write-Host ""

Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Test run:     node `"$ScriptPath`"" -ForegroundColor White
Write-Host "  Start task:   Start-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host "  Disable:      Disable-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host "  Enable:       Enable-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor White
Write-Host "  Remove:       Unregister-ScheduledTask -TaskName `"$TaskName`" -Confirm:`$false" -ForegroundColor White
Write-Host ""

# Offer to run test
$runTest = Read-Host "Would you like to run a test now? (y/n)"
if ($runTest -eq 'y' -or $runTest -eq 'Y') {
    Write-Host ""
    Write-Host "Running test..." -ForegroundColor Cyan
    Write-Host ""
    
    Start-Process -FilePath $NodePath -ArgumentList "`"$ScriptPath`"" -WorkingDirectory $PSScriptRoot -NoNewWindow -Wait
    
    Write-Host ""
    Write-Host "Test complete! Check the output above for results." -ForegroundColor Green
}

Write-Host ""
Write-Host "SML Validation Processing is now active!" -ForegroundColor Green
Write-Host ""
