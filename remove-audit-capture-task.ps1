# PowerShell Script to Remove PS Audit Trail Capture Task

Write-Host "🗑️  Removing PS Audit Trail Capture Task..." -ForegroundColor Cyan
Write-Host ""

$taskName = "PS-Audit-Trail-Capture"

# Check if task exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $existingTask) {
    Write-Host "ℹ️  Task '$taskName' does not exist. Nothing to remove." -ForegroundColor Yellow
    exit 0
}

Write-Host "⚠️  Found task: $taskName" -ForegroundColor Yellow
$confirm = Read-Host "Are you sure you want to remove it? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "✅ Task removed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error removing task: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Cancelled. Task not removed." -ForegroundColor Yellow
}

Write-Host ""

