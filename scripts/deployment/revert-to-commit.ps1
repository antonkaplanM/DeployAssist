# Revert to specific commit
# This script will reset the repository to commit 456858a125ae1943ea92ead210dcf0acc6614ce9

$targetCommit = "456858a125ae1943ea92ead210dcf0acc6614ce9"

Write-Host "🔄 Reverting to commit $targetCommit..." -ForegroundColor Yellow

# Configure git to not use pager
$env:GIT_PAGER = ""
git config --global core.pager ""

# Show current branch
Write-Host "`n📍 Current branch:" -ForegroundColor Cyan
git rev-parse --abbrev-ref HEAD

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "`n⚠️ You have uncommitted changes:" -ForegroundColor Yellow
    git status --short
    Write-Host "`nOptions:" -ForegroundColor Cyan
    Write-Host "1. Stash changes: git stash" -ForegroundColor Gray
    Write-Host "2. Discard changes: git reset --hard" -ForegroundColor Gray
    Write-Host "3. Commit changes first: git add . && git commit -m 'message'" -ForegroundColor Gray
    exit 1
}

# Perform the reset
Write-Host "`n🔄 Resetting to commit $targetCommit..." -ForegroundColor Yellow
git reset --hard $targetCommit

Write-Host "`n✅ Successfully reverted to commit $targetCommit" -ForegroundColor Green
Write-Host "`n📊 Current commit:" -ForegroundColor Cyan
git log --oneline -1

Write-Host "`n💡 Note: If you want to push this to remote, you'll need:" -ForegroundColor Cyan
Write-Host "   git push origin <branch> --force" -ForegroundColor Gray
Write-Host "   ⚠️ Be careful with --force as it rewrites history!" -ForegroundColor Yellow

