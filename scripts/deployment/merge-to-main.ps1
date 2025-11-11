# Merge current state to main branch
# Run this script to merge your current commit to main

Write-Host "🔄 Merging current state to main branch..." -ForegroundColor Yellow

# Disable git pager
$env:GIT_PAGER = ""

# Step 1: Check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "`n📍 Current branch: $currentBranch" -ForegroundColor Cyan

# Step 2: Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "`n⚠️ You have uncommitted changes. Committing them first..." -ForegroundColor Yellow
    git add .
    git commit -m "Changes before merging to main"
    Write-Host "✅ Changes committed" -ForegroundColor Green
}

# Step 3: Switch to main branch
Write-Host "`n🔄 Switching to main branch..." -ForegroundColor Yellow
git checkout main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to switch to main branch" -ForegroundColor Red
    exit 1
}

# Step 4: Pull latest from remote main
Write-Host "`n⬇️ Pulling latest changes from remote main..." -ForegroundColor Yellow
git pull origin main

# Step 5: Merge the feature branch into main
Write-Host "`n🔀 Merging $currentBranch into main..." -ForegroundColor Yellow
git merge $currentBranch -m "Merge $currentBranch into main"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully merged to main!" -ForegroundColor Green
    Write-Host "`n📊 Current status:" -ForegroundColor Cyan
    git log --oneline -3
    
    Write-Host "`n💡 Next steps:" -ForegroundColor Cyan
    Write-Host "   To push to remote: git push origin main" -ForegroundColor Gray
} else {
    Write-Host "`n⚠️ Merge conflict detected. Please resolve conflicts and then:" -ForegroundColor Yellow
    Write-Host "   1. Fix conflicts in the files" -ForegroundColor Gray
    Write-Host "   2. git add ." -ForegroundColor Gray
    Write-Host "   3. git commit" -ForegroundColor Gray
    Write-Host "   4. git push origin main" -ForegroundColor Gray
}

