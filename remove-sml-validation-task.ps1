# Remove SML Validation Processing Task from Windows Task Scheduler

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$TaskName = "SML-Validation-Processing"

Write-Host "`n🗑️  Remove SML Validation Processing Task" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check if task exists
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "ℹ️  Task '$TaskName' does not exist" -ForegroundColor Yellow
    Write-Host "   Nothing to remove" -ForegroundColor Gray
    exit 0
}

# Show current task info
$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "Current Task Status:" -ForegroundColor Cyan
Write-Host "  • State:     $($task.State)" -ForegroundColor White
Write-Host "  • Last Run:  $($taskInfo.LastRunTime)" -ForegroundColor White
Write-Host "  • Next Run:  $($taskInfo.NextRunTime)" -ForegroundColor White
Write-Host ""

# Confirm removal
$response = Read-Host "Are you sure you want to remove this task? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host ""
        Write-Host "✅ Task '$TaskName' removed successfully!" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host ""
        Write-Host "❌ Failed to remove task: $_" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Removal cancelled" -ForegroundColor Yellow
    Write-Host ""
}

