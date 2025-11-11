# Technical Documentation

## Overview
This directory contains comprehensive technical documentation for the Deployment Assistant application.

## Documentation Index

### Setup & Configuration
- **[Quick-Setup-Guide.md](./Quick-Setup-Guide.md)** - Fast setup instructions for environment configuration
- **[Database-README.md](./Database-README.md)** - Database setup and management
- **[PostgreSQL-Setup-Complete.md](./PostgreSQL-Setup-Complete.md)** - Complete PostgreSQL installation guide

### Architecture & Integration
- **[Integration-Architecture.md](./Integration-Architecture.md)** - System architecture and integration details
- **[Jira-Integration-Guide.md](./Jira-Integration-Guide.md)** - Atlassian/Jira integration setup

### Feature Documentation
- **[Account-History-Feature.md](./Account-History-Feature.md)** - Account history tracking functionality
- **[Analytics-Validation-Integration.md](./Analytics-Validation-Integration.md)** - Analytics and validation integration
- **[Customer-Products-Feature.md](./Customer-Products-Feature.md)** - Customer products view
- **[Expiration-Monitor-Feature.md](./Expiration-Monitor-Feature.md)** - Product expiration tracking
- **[Expiration-Monitor-Filtering-Enhancement.md](./Expiration-Monitor-Filtering-Enhancement.md)** - Advanced filtering features
- **[Product-Removals-Feature.md](./Product-Removals-Feature.md)** - Product removal tracking
- **[Validation-Rules-Documentation.md](./Validation-Rules-Documentation.md)** - Data validation system

### Testing & Quality
- **[Testing-Strategy.md](./Testing-Strategy.md)** - Testing approach and methodology
- **[Customer-Products-Testing-Summary.md](./Customer-Products-Testing-Summary.md)** - Customer products test results

### Operations & Troubleshooting
- **[Database-Quick-Reference.md](./Database-Quick-Reference.md)** - Quick database commands reference
- **[Troubleshooting-Checklist.md](./Troubleshooting-Checklist.md)** - Common issues and solutions

### Changelogs
- **[CHANGELOG-Account-History.md](./CHANGELOG-Account-History.md)** - Account history feature changes
- **[CHANGELOG-Analytics-Enhancement.md](./CHANGELOG-Analytics-Enhancement.md)** - Analytics improvements
- **[CHANGELOG-Analytics-Trend-Enhancement.md](./CHANGELOG-Analytics-Trend-Enhancement.md)** - Trend chart updates
- **[CHANGELOG-Expiration-Monitor.md](./CHANGELOG-Expiration-Monitor.md)** - Expiration monitor updates
- **[CHANGELOG-Settings-Enhancements.md](./CHANGELOG-Settings-Enhancements.md)** - Settings page and auto-refresh improvements

### Implementation Summaries
- **[Expiration-Monitor-Implementation-Summary.md](./Expiration-Monitor-Implementation-Summary.md)** - Complete expiration monitor implementation details

## Recent Updates (January 2025)

### Settings Page Enhancements
- **Auto-Refresh System**: All data pages now support automatic background refresh
  - Configurable intervals: Never, 1, 5 (default), 10, 15, or 30 minutes
  - Smart refresh logic: refreshes inactive pages only (pauses on active page)
  - Last refresh timestamps on each page
  
- **Validation Rules Relocation**: Moved from separate page to Settings section
  - Centralized configuration management
  - All functionality preserved
  - Cleaner navigation structure

See [CHANGELOG-Settings-Enhancements.md](./CHANGELOG-Settings-Enhancements.md) for complete details.

## Quick Links

### For Developers
1. Start with [Integration-Architecture.md](./Integration-Architecture.md) for system overview
2. Review [Testing-Strategy.md](./Testing-Strategy.md) for testing approach
3. Check relevant feature documentation for implementation details

### For Administrators  
1. Follow [Quick-Setup-Guide.md](./Quick-Setup-Guide.md) for initial setup
2. Use [Database-README.md](./Database-README.md) for database configuration
3. Refer to [Troubleshooting-Checklist.md](./Troubleshooting-Checklist.md) for common issues

### For Users
1. Use the in-app Help page for feature guides
2. Check [Validation-Rules-Documentation.md](./Validation-Rules-Documentation.md) for validation details
3. Review feature-specific documentation for advanced usage

## Documentation Standards

All documentation follows these standards:
- **Markdown Format**: All docs use GitHub-flavored Markdown
- **Version Tracking**: Changelogs document all significant changes
- **Code Examples**: Practical examples included where applicable
- **Clear Structure**: Consistent headings and organization
- **Up-to-Date**: Documentation updated with feature changes

## Contributing

When adding new features or making changes:
1. Update relevant feature documentation
2. Add entry to appropriate CHANGELOG
3. Update this README index if new docs added
4. Keep Quick-Setup-Guide current with any setup changes

## Support

For questions or issues:
- Check [Troubleshooting-Checklist.md](./Troubleshooting-Checklist.md) first
- Review feature-specific documentation
- Consult the in-app Help page
- Check recent changelogs for known issues

---

*Last Updated: January 2025*
