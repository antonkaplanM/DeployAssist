# PowerShell Script to Set Up PS Audit Trail Capture Task
# This creates a Windows Task Scheduler task that runs every 5 minutes

Write-Host "Setting up PS Audit Trail Capture Task..." -ForegroundColor Cyan
Write-Host ""

# Get the current directory
$scriptPath = (Get-Location).Path
$wscriptPath = "C:\Windows\System32\wscript.exe"
$vbsWrapper = Join-Path $scriptPath "run-capture-hidden.vbs"
$captureScript = Join-Path $scriptPath "capture-ps-changes.js"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "   VBS Wrapper: $vbsWrapper"
Write-Host "   Capture Script: $captureScript"
Write-Host "   Working Directory: $scriptPath"
Write-Host "   Frequency: Every 5 minutes"
Write-Host "   Window: Hidden (no popup)"
Write-Host ""

# Check if the capture script exists
if (-not (Test-Path $captureScript)) {
    Write-Host "Error: capture-ps-changes.js not found!" -ForegroundColor Red
    Write-Host "Expected location: $captureScript" -ForegroundColor Red
    exit 1
}

# Check if the VBS wrapper exists
if (-not (Test-Path $vbsWrapper)) {
    Write-Host "Error: run-capture-hidden.vbs not found!" -ForegroundColor Red
    Write-Host "Expected location: $vbsWrapper" -ForegroundColor Red
    Write-Host "Please ensure the VBS wrapper script is in the same directory." -ForegroundColor Red
    exit 1
}

# Task name
$taskName = "PS-Audit-Trail-Capture"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task '$taskName' already exists." -ForegroundColor Yellow
    $response = Read-Host "Do you want to recreate it? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Removing existing task..." -ForegroundColor Yellow
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Existing task removed" -ForegroundColor Green
    }
    else {
        Write-Host "Cancelled. Exiting." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Creating scheduled task..." -ForegroundColor Cyan

# Create the action (what to run) - use VBScript wrapper to hide window
$action = New-ScheduledTaskAction -Execute $wscriptPath -Argument "`"$vbsWrapper`"" -WorkingDirectory $scriptPath

# Create the trigger (when to run - every 5 minutes for 365 days, which will auto-renew)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)

# Create the principal (run as current user, VBS wrapper handles hiding window)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# Create the settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Captures PS record changes every 5 minutes for audit trail tracking" -ErrorAction Stop | Out-Null
    
    Write-Host ""
    Write-Host "Task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "   Name: $taskName"
    Write-Host "   Frequency: Every 5 minutes"
    Write-Host "   Status: Ready to run"
    Write-Host "   Next Run: Within 5 minutes"
    Write-Host ""
    Write-Host "To view the task:" -ForegroundColor Yellow
    Write-Host "   1. Open Task Scheduler (taskschd.msc)"
    Write-Host "   2. Look for '$taskName' in Task Scheduler Library"
    Write-Host ""
    Write-Host "To test immediately:" -ForegroundColor Yellow
    Write-Host "   Run: Start-ScheduledTask -TaskName '$taskName'"
    Write-Host "   Or:  wscript run-capture-hidden.vbs (no popup)"
    Write-Host "   Or:  node capture-ps-changes.js (will show window)"
    Write-Host ""
    
    # Ask if user wants to test now
    $testNow = Read-Host "Do you want to test the task now? (y/n)"
    if ($testNow -eq 'y' -or $testNow -eq 'Y') {
        Write-Host ""
        Write-Host "Running test capture..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $taskName
        Write-Host "Task started. Check Task Scheduler for results." -ForegroundColor Green
        Write-Host "The task will continue to run every 5 minutes automatically." -ForegroundColor Green
    }
}
catch {
    Write-Host ""
    Write-Host "Error creating task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Make sure you run PowerShell as Administrator"
    Write-Host "   2. Check that Node.js is in your PATH"
    Write-Host "   3. Verify capture-ps-changes.js exists in current directory"
    exit 1
}

Write-Host ""
Write-Host "Setup complete! PS Audit Trail will now track changes every 5 minutes." -ForegroundColor Green
Write-Host ""
