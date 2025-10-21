# Steps to Remove Secrets from Git History

## Summary of Changes Made
1. ✅ Updated `.gitignore` to exclude `.salesforce_auth.json`
2. ✅ Deleted `.salesforce_auth.json` (contains exposed access token)
3. ✅ Created `.salesforce_auth.json.example` as template
4. ✅ Updated `Technical Documentation/05-Integrations/SALESFORCE-PROD-CONNECTED.md` to remove exposed secrets
5. ✅ Updated `frontend/src/pages/ProvisioningRequests.jsx` to fix pagination

## Files That Need to be Committed
- `.gitignore` (added .salesforce_auth.json exclusion)
- `.salesforce_auth.json.example` (new template file)
- `Technical Documentation/05-Integrations/SALESFORCE-PROD-CONNECTED.md` (secrets removed)
- `frontend/src/pages/ProvisioningRequests.jsx` (pagination fix)
- `.salesforce_auth.json` (should be deleted/untracked)

## Manual Steps to Clean Up Git History

### Step 1: Stage the changes
```powershell
git add .gitignore
git add .salesforce_auth.json.example
git add "Technical Documentation/05-Integrations/SALESFORCE-PROD-CONNECTED.md"
git add "frontend/src/pages/ProvisioningRequests.jsx"
git rm --cached .salesforce_auth.json
```

### Step 2: Amend the current commit
```powershell
git commit --amend -m "refactored the spa into a multi-page react app with routing control (secrets removed)"
```

### Step 3: Use BFG Repo Cleaner to remove secrets from history
Download BFG: https://rtyley.github.io/bfg-repo-cleaner/

```powershell
# Remove .salesforce_auth.json from all commits
java -jar bfg.jar --delete-files .salesforce_auth.json

# Clean up the repository
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 4: Force push (CAREFUL!)
```powershell
git push origin feature/react-migration --force
```

## Alternative: Interactive Rebase (if you prefer manual control)

```powershell
# Start interactive rebase from before the problematic commit
git rebase -i 56ad216b979d5cf28fe0cc94394b4c7ffdacd2ec~1

# In the editor, change 'pick' to 'edit' for commit 56ad216b979d5cf28fe0cc94394b4c7ffdacd2ec
# Save and close the editor

# Remove the file from this commit
git rm --cached .salesforce_auth.json
git rm --cached "Technical Documentation/05-Integrations/SALESFORCE-PROD-CONNECTED.md"

# Stage the corrected files
git add .gitignore
git add .salesforce_auth.json.example
git add "Technical Documentation/05-Integrations/SALESFORCE-PROD-CONNECTED.md"
git add "frontend/src/pages/ProvisioningRequests.jsx"

# Amend this commit
git commit --amend --no-edit

# Continue the rebase
git rebase --continue

# Force push
git push origin feature/react-migration --force
```

## Verification
After pushing, verify no secrets remain:
```powershell
git log --all --full-history -- .salesforce_auth.json
git grep -i "3MVG99OxTyEMCQ3gwyGIr9BBfx"
git grep -i "E894E82B2B672FACA21923C3B3E29C45"
```

## Important Notes
- The `.env` file already contains the credentials and is properly in `.gitignore`
- After cleanup, `.salesforce_auth.json` will be regenerated automatically when the app runs
- All exposed secrets have been removed from the documentation
- The pagination fix for ProvisioningRequests.jsx is included in this commit

