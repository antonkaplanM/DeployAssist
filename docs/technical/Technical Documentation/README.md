# Technical Documentation

## 📚 Documentation Structure

This folder contains all technical documentation for the Deployment Assistant application, organized by topic.

### Quick Navigation

| Folder | Description | Key Files |
|--------|-------------|-----------|
| **[01-Getting-Started](./01-Getting-Started/)** | Setup guides, troubleshooting | START-HERE, Quick-Setup-Guide |
| **[02-Architecture](./02-Architecture/)** | System architecture, refactoring | TypeScript Architecture, Migration Guide |
| **[03-Features](./03-Features/)** | Feature documentation | All feature implementations |
| **[04-Database](./04-Database/)** | Database setup and schema | PostgreSQL setup, Quick Reference |
| **[05-Integrations](./05-Integrations/)** | External integrations | Salesforce, Jira, Packages |
| **[06-Testing](./06-Testing/)** | Testing strategies | Testing Strategy |
| **[07-Bug-Fixes](./07-Bug-Fixes/)** | Bug fix documentation | Historical fixes |
| **[08-Changelogs](./08-Changelogs/)** | Change history | All changelogs |
| **[09-Authentication](./09-Authentication/)** | Authentication & user management | Setup guide, Integration guides |
| **[10-Security](./10-Security/)** | Security & credentials | Environment variables, Security updates |

---

## 🚀 Getting Started

### New to the Project?
1. **Read**: [01-Getting-Started/START-HERE.md](./01-Getting-Started/START-HERE.md)
2. **Setup**: [01-Getting-Started/Quick-Setup-Guide.md](./01-Getting-Started/Quick-Setup-Guide.md)
3. **Troubleshoot**: [01-Getting-Started/Troubleshooting-Checklist.md](./01-Getting-Started/Troubleshooting-Checklist.md)

### Want to Understand the Architecture?
1. **Current State**: [02-Architecture/RECOMMENDED-APPROACH.md](./02-Architecture/RECOMMENDED-APPROACH.md)
2. **Refactoring**: [02-Architecture/REFACTORING-SUMMARY.md](./02-Architecture/REFACTORING-SUMMARY.md)
3. **TypeScript**: [02-Architecture/TypeScript-Architecture.md](./02-Architecture/TypeScript-Architecture.md)

### Working on Features?
- Browse: [03-Features/](./03-Features/)
- All feature implementations documented

### Database Work?
- Setup: [04-Database/PostgreSQL-Setup-Complete.md](./04-Database/PostgreSQL-Setup-Complete.md)
- Reference: [04-Database/Database-Quick-Reference.md](./04-Database/Database-Quick-Reference.md)

---

## 📂 Detailed Contents

### 01-Getting-Started
Essential guides for getting up and running:
- **START-HERE.md** - Start here! Quick decision guide
- **Quick-Setup-Guide.md** - Full setup instructions
- **TypeScript-Quick-Start.md** - TypeScript version quick start
- **TAILWIND-SETUP.md** - Tailwind CSS setup
- **DEBUG-INSTRUCTIONS.md** - Debugging guide
- **Troubleshooting-Checklist.md** - Common issues and solutions
- **Technical-Docs-Overview.md** - Documentation overview

### 02-Architecture
System design and architectural decisions:
- **RECOMMENDED-APPROACH.md** - Current development strategy (JavaScript now, TypeScript later)
- **REFACTORING-SUMMARY.md** - Complete refactoring summary and what was delivered
- **MIGRATION-GUIDE.md** - Step-by-step TypeScript migration guide
- **TypeScript-Architecture.md** - TypeScript code structure
- **Integration-Architecture.md** - Integration patterns
- **SECURITY-ADVISORY.md** - Security improvements and vulnerabilities
- **TYPESCRIPT-BUILD-FIXES.md** - TypeScript compilation fixes
- **NPM-INSTALL-SUMMARY.md** - Dependency management

### 03-Features
Detailed feature documentation:
- **Account-History-Feature.md** - Account history tracking
- **Customer-Products-Feature.md** - Customer products management
- **Customer-Products-Testing-Summary.md** - Testing results
- **Experimental-Pages-Roadmap.md** - Experimental pages and Jira roadmap integration
- **Experimental-Pages-Setup-Summary.md** - Setup guide for experimental pages
- **Expiration-Monitor-Feature.md** - Expiration monitoring
- **Expiration-Monitor-Implementation-Summary.md** - Implementation details
- **Expiration-Monitor-Filtering-Enhancement.md** - Filtering improvements
- **Help-Page-Implementation.md** - React help page implementation
- **Notification-System-Feature.md** - Notification system
- **Notification-Implementation-Summary.md** - Implementation details
- **Notification-Quick-Start.md** - Quick start guide
- **Notification-Testing-and-Help-Update.md** - Testing and help
- **Package-Info-Helper-Feature.md** - Package information helper
- **Product-Removals-Feature.md** - Product removal tracking
- **Validation-Rules-Documentation.md** - Validation rules engine
- **Analytics-Validation-Integration.md** - Analytics integration
- **Dashboard-Expiration-Widget.md** - Dashboard widgets
- **Dashboard-Responsive-Layout.md** - Responsive design
- **Navigation-Reorganization.md** - Navigation structure

### 04-Database
Database setup, schema, and management:
- **Database-README.md** - Database overview
- **Database-Quick-Reference.md** - Quick reference guide
- **PostgreSQL-Setup-Complete.md** - Complete PostgreSQL setup

Also see: `database/` folder in project root for SQL scripts

### 05-Integrations
External system integrations:
- **SALESFORCE-PROD-CONNECTED.md** - Salesforce production connection
- **Jira-Integration-Guide.md** - Jira/Atlassian integration
- **Packages-Integration-Summary.md** - Package system integration

### 06-Testing
Testing strategies and documentation:
- **Testing-Strategy.md** - Overall testing approach
- **Test-Execution-Results.md** - Test execution results and status
- **Test-Suite-Execution-Complete.md** - Test suite execution summary
- **Test-Suite-Migration-Complete.md** - Test migration to React app
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`

Also see: `tests/` folder in project root for test implementation

### 07-Bug-Fixes
Historical bug fix documentation:
- **Expiration-Monitor-Bug-Fix-Part2.md** - Expiration monitor fixes (complete)
- **Expiration-Monitor-Extended-Fix.md** - Extended expiration monitor fix
- **Field-Mapping-Fix-Complete.md** - Field mapping fix (complete)
- **PS-4652-FINAL-FIX.md** - PS-4652 fix (final version)
- **ISSUE-ANALYSIS-SUMMARY.md** - Issue analysis
- **CUSTOMER-PRODUCTS-PS-4215-FIX.md** - Customer products bug fix
- **CUSTOMER-PRODUCTS-BROKE-AFTER-INITIAL-FIX.md** - Customer products follow-up fix
- **Expiration-Monitor-Date-Rollup-Fix.md** - Date rollup fix

### 08-Changelogs
Change history by feature:
- **CHANGELOG-Account-History.md** - Account history changes
- **CHANGELOG-Analytics-Enhancement.md** - Analytics changes
- **CHANGELOG-Analytics-Trend-Enhancement.md** - Trend chart changes
- **CHANGELOG-Experimental-Pages-Oct-2025.md** - Experimental pages and roadmap feature
- **CHANGELOG-Expiration-Monitor.md** - Expiration monitor changes
- **CHANGELOG-Settings-Enhancements.md** - Settings changes
- **CHANGELOG-PS-Audit-Trail.md** - PS audit trail changes
- And more...

### 09-Authentication
Authentication and user management system:
- **SETUP-AND-TEST-NOW.md** - Quick setup guide ⭐ START HERE
- **AUTHENTICATION-IMPLEMENTATION-SUMMARY.md** - Complete technical details
- **JAVASCRIPT-AUTH-INTEGRATION.md** - Backend integration guide
- **FRONTEND-INTEGRATION-GUIDE.md** - Frontend integration guide
- **README-AUTHENTICATION.md** - System overview and features
- **AUTHENTICATION-QUICKSTART.md** - Quick reference
- **COMPLETE-AUTH-SYSTEM-READY.md** - Implementation roadmap
- **PAGE-ENTITLEMENTS-SYSTEM.md** - Page-level permissions system

**Key Features:**
- User creation, editing, deletion
- Role-based access control (RBAC)
- Page-level permissions and entitlements
- JWT-based authentication with HTTP-only cookies
- Session management with inactivity timeout
- Password hashing and validation
- Account lockout protection
- Audit logging for security events

**Utility Scripts** (in project root):
- `setup-admin-user.js` - Create/reinitialize admin user
- `unlock-user.js` - Unlock locked accounts
- `run-auth-migration.js` - Database setup

### 10-Security
Security documentation and credential management:
- **README.md** - Security documentation overview
- **Security-Update-Quick-Start.md** - Quick start guide for security updates
- **Environment-Variables-Security.md** - Environment variable security overview
- **Environment-Variables-Detailed-Guide.md** - Comprehensive technical guide
- **Update-Existing-Env-File.md** - Guide for updating .env file
- **Security-Update-Summary.md** - Summary of all security changes
- **Security-Audit-Report.md** - Complete security audit report

**Key Topics:**
- Environment variable management
- Database credential security
- Removing hardcoded secrets
- .env file configuration
- PowerShell script security
- GitHub secret scanning compliance

---

## 🔍 Finding What You Need

### By Task

| I Want To... | See |
|-------------|-----|
| Get started quickly | [01-Getting-Started/START-HERE.md](./01-Getting-Started/START-HERE.md) |
| Set up the application | [01-Getting-Started/Quick-Setup-Guide.md](./01-Getting-Started/Quick-Setup-Guide.md) |
| Set up authentication | [09-Authentication/SETUP-AND-TEST-NOW.md](./09-Authentication/SETUP-AND-TEST-NOW.md) ⭐ |
| Understand the architecture | [02-Architecture/RECOMMENDED-APPROACH.md](./02-Architecture/RECOMMENDED-APPROACH.md) |
| Migrate to TypeScript | [02-Architecture/MIGRATION-GUIDE.md](./02-Architecture/MIGRATION-GUIDE.md) |
| Learn about a feature | [03-Features/](./03-Features/) |
| Set up the database | [04-Database/PostgreSQL-Setup-Complete.md](./04-Database/PostgreSQL-Setup-Complete.md) |
| Integrate with Salesforce | [05-Integrations/SALESFORCE-PROD-CONNECTED.md](./05-Integrations/SALESFORCE-PROD-CONNECTED.md) |
| Manage users and roles | [09-Authentication/README.md](./09-Authentication/README.md) |
| Configure security | [10-Security/README.md](./10-Security/README.md) ⭐ |
| Update .env file | [10-Security/Update-Existing-Env-File.md](./10-Security/Update-Existing-Env-File.md) |
| Fix an issue | [01-Getting-Started/Troubleshooting-Checklist.md](./01-Getting-Started/Troubleshooting-Checklist.md) |
| Review what changed | [08-Changelogs/](./08-Changelogs/) |

### By Role

**New Developer:**
1. [START-HERE](./01-Getting-Started/START-HERE.md)
2. [Quick-Setup-Guide](./01-Getting-Started/Quick-Setup-Guide.md)
3. [RECOMMENDED-APPROACH](./02-Architecture/RECOMMENDED-APPROACH.md)

**Architect/Lead:**
1. [REFACTORING-SUMMARY](./02-Architecture/REFACTORING-SUMMARY.md)
2. [Integration-Architecture](./02-Architecture/Integration-Architecture.md)
3. [SECURITY-ADVISORY](./02-Architecture/SECURITY-ADVISORY.md)

**QA/Tester:**
1. [Testing-Strategy](./06-Testing/Testing-Strategy.md)
2. Feature docs in [03-Features](./03-Features/)
3. [Customer-Products-Testing-Summary](./03-Features/Customer-Products-Testing-Summary.md)

**DevOps:**
1. [Database-README](./04-Database/Database-README.md)
2. [PostgreSQL-Setup-Complete](./04-Database/PostgreSQL-Setup-Complete.md)
3. Integration guides in [05-Integrations](./05-Integrations/)

---

## 📝 Documentation Standards

### When to Create Documentation

- **New Feature**: Create in `03-Features/`
- **Architecture Change**: Document in `02-Architecture/`
- **Bug Fix**: Document in `07-Bug-Fixes/`
- **Breaking Change**: Update changelog in `08-Changelogs/`

### Document Naming

- Use kebab-case: `feature-name-description.md`
- Be descriptive: `Customer-Products-Feature.md` not `CP.md`
- Add category prefix if needed: `CHANGELOG-Feature.md`

### Document Structure

```markdown
# Title

## Overview
Brief description

## Details
Comprehensive information

## Usage/Implementation
How to use or implement

## Testing
How to test

## Related Documents
Links to related docs
```

---

## 🔄 Recent Changes

**October 22, 2025: Security & Experimental Pages Update**
- ✅ Created new 10-Security section for credential management
- ✅ Removed hardcoded database passwords from all scripts
- ✅ Implemented environment variable security
- ✅ Added Experimental Pages feature with Jira Roadmap integration
- ✅ Created comprehensive security documentation
- ✅ Updated all PowerShell scripts to use .env file
- ✅ Added ADF (Atlassian Document Format) support in Roadmap
- ✅ Organized all security and feature documentation
- ✅ Clean repository root (no loose documentation files)

**October 22, 2025: Documentation Consolidation**
- ✅ Moved all root-level documentation to proper folders
- ✅ Added Help-Page-Implementation to 03-Features
- ✅ Consolidated test suite documentation to 06-Testing
- ✅ Moved bug fixes to 07-Bug-Fixes
- ✅ Removed temporary cleanup/reorganization files
- ✅ Updated this index with all new files

**October 2025: Documentation Reorganization**
- ✅ Created organized folder structure
- ✅ Moved all documentation to Technical Documentation folder
- ✅ Categorized by purpose (Getting Started, Architecture, Features, etc.)
- ✅ Created comprehensive index (this file)
- ✅ Removed redundant files

**October 2025: TypeScript Refactoring**
- ✅ Complete TypeScript infrastructure
- ✅ Architecture documentation
- ✅ Migration guides
- ✅ Security improvements

---

## 💡 Tips

- **Use search**: All docs are markdown - easy to search
- **Follow links**: Documents link to related content
- **Start with START-HERE**: Best entry point
- **Check changelogs**: See what changed recently
- **Troubleshooting first**: Common issues already documented

---

## 📞 Need Help?

1. Check [Troubleshooting-Checklist](./01-Getting-Started/Troubleshooting-Checklist.md)
2. Search this folder for keywords
3. Check [Bug-Fixes](./07-Bug-Fixes/) for similar issues
4. Review [Testing-Strategy](./06-Testing/Testing-Strategy.md)

---

## ✅ Quick Reference

### Commands
```bash
# Start application
npm start

# Run tests
npm test
npm run test:e2e

# Build TypeScript (optional)
npm run build
npm run start:ts
```

### Important Files
- **Main App**: `app.js`
- **Salesforce**: `salesforce.js`
- **Database**: `database.js`
- **Config**: `.env`

### Ports
- **App**: 8080 (JavaScript) / 8081 (TypeScript)
- **Database**: 5432 (PostgreSQL)

---

**Last Updated**: October 22, 2025  
**Version**: 2.2  
**Status**: ✅ Organized and Up-to-Date  
**Latest Additions**: Security section (10-Security), Experimental Pages, Roadmap feature

