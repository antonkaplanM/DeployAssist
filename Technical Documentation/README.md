# Technical Documentation

Welcome to the technical documentation for the Deployment Assistant application integrations.

## 📁 Documentation Files

### 🏗️ [Integration Architecture](./Integration-Architecture.md)
**Complete technical reference**
- Detailed architecture documentation
- Implementation specifics for both Atlassian and Salesforce
- Security considerations and best practices
- Environment configuration details
- Performance metrics and maintenance procedures

### ⚡ [Quick Setup Guide](./Quick-Setup-Guide.md)
**Get up and running fast**
- Step-by-step environment setup
- Required configurations for both integrations
- Common issues and quick solutions
- Architecture overview diagram

### 🔧 [Troubleshooting Checklist](./Troubleshooting-Checklist.md)
**Systematic problem resolution**
- Issue identification guides
- Step-by-step troubleshooting procedures
- Diagnostic tools and commands
- Recovery procedures

### 📊 [Account History Feature](./Account-History-Feature.md)
**Track account product evolution**
- Comprehensive feature documentation
- User workflows and use cases
- Technical implementation details
- UX patterns and design principles
- Testing coverage and strategies

### ✅ [Validation Rules Documentation](./Validation-Rules-Documentation.md)
**Payload validation system**
- Validation rule descriptions
- Implementation details
- Testing and troubleshooting

### 🗑️ [Product Removals Feature](./Product-Removals-Feature.md)
**Product removal tracking and monitoring**
- Feature overview and implementation
- Monitoring dashboard details
- API endpoints and usage

### 🧪 [Testing Strategy](./Testing-Strategy.md)
**Comprehensive test coverage**
- Unit, integration, and E2E testing approach
- Test execution guidelines
- Coverage reports and best practices
- Feature-specific test documentation

### 🗄️ [PostgreSQL Setup Complete](./PostgreSQL-Setup-Complete.md)
**Database connection and configuration**
- Complete PostgreSQL setup guide
- Connection module documentation
- API reference and best practices
- Transaction management and security

### 📚 [Database README](./Database-README.md)
**Database directory overview**
- Quick links to database documentation
- Current setup status
- Quick start examples

### ⚡ [Database Quick Reference](./Database-Quick-Reference.md)
**Fast lookup for common database operations**
- Connection details
- Common SQL operations
- Environment variables
- Useful commands

## 🎯 Quick Navigation

### For Developers
- **New to the project?** → Start with [Quick Setup Guide](./Quick-Setup-Guide.md)
- **Need implementation details?** → See [Integration Architecture](./Integration-Architecture.md)
- **Something not working?** → Check [Troubleshooting Checklist](./Troubleshooting-Checklist.md)
- **Database setup?** → See [PostgreSQL Setup Complete](./PostgreSQL-Setup-Complete.md)
- **Quick database reference?** → See [Database Quick Reference](./Database-Quick-Reference.md)
- **Account History feature?** → See [Account History Feature](./Account-History-Feature.md)
- **Product Removals feature?** → See [Product Removals Feature](./Product-Removals-Feature.md)
- **Testing guidance?** → See [Testing Strategy](./Testing-Strategy.md)

### For DevOps/Infrastructure
- **Environment setup** → [Quick Setup Guide - Environment Setup](./Quick-Setup-Guide.md#environment-setup)
- **Security configuration** → [Integration Architecture - Security Considerations](./Integration-Architecture.md#security-considerations)
- **Performance monitoring** → [Integration Architecture - Performance Metrics](./Integration-Architecture.md#performance-metrics)

### For Support Teams
- **Common issues** → [Troubleshooting Checklist](./Troubleshooting-Checklist.md)
- **Diagnostic tools** → [Troubleshooting Checklist - Diagnostic Tools](./Troubleshooting-Checklist.md#diagnostic-tools)
- **Recovery procedures** → [Troubleshooting Checklist - Recovery Procedures](./Troubleshooting-Checklist.md#recovery-procedures)

## 🔗 Integration Overview

### Atlassian (Jira Cloud)
- **Type**: Direct REST API
- **Authentication**: Basic Auth with API tokens
- **Purpose**: Fetch project initiatives, epics, stories, and tasks
- **Status**: ✅ Operational with SSL bypass for corporate environments

### Salesforce
- **Type**: OAuth 2.0 Client Credentials Flow
- **Authentication**: Server-to-server (no user interaction)
- **Purpose**: Professional Services Request management
- **Status**: ✅ Operational with automatic token management

### PostgreSQL Database
- **Type**: Connection Pool with pg driver
- **Authentication**: Username/password
- **Purpose**: Application data storage and persistence
- **Version**: PostgreSQL 16.8 (64-bit)
- **Status**: ✅ Connected and operational

## 🚀 Current Status

| Integration | Status | Last Updated | Records Available |
|-------------|--------|--------------|-------------------|
| Atlassian   | ✅ Active | 2025-09-24 | ~100 issues/query |
| Salesforce  | ✅ Active | 2025-09-24 | 3,369 PS requests |
| PostgreSQL  | ✅ Active | 2025-09-30 | deployment_assistant DB |

## 🛠️ Built-in Diagnostics

The application includes comprehensive diagnostic tools:

### Salesforce Diagnostics
- **Web Interface**: Settings page → "Test Salesforce" button
- **API Endpoint**: `GET /api/test-salesforce`
- **Tests**: Environment variables, OAuth configuration, authentication status, API connectivity

### Atlassian Diagnostics
- **Real-time logging**: Monitor terminal output during API calls
- **Fallback mechanism**: Automatic degradation to mock data if API unavailable
- **SSL status**: Clear indication of certificate handling

### Database Diagnostics
- **API Endpoint**: `GET /api/health/database`
- **Tests**: Connection status, pool statistics, query execution
- **Built-in Functions**: `testConnection()`, `getPoolStats()`

## 📋 Pre-flight Checklist

Before deploying or troubleshooting:

- [ ] Environment variables configured in `.env` file
- [ ] PostgreSQL database connection configured
- [ ] Salesforce Connected App uses Client Credentials Flow only
- [ ] Atlassian API token has appropriate permissions
- [ ] SSL bypass configured for corporate networks
- [ ] Application logs are being monitored
- [ ] Database health check endpoint responding

## 🔄 Maintenance Schedule

### Weekly
- [ ] Monitor application logs for authentication issues
- [ ] Verify API response times are within acceptable limits

### Monthly  
- [ ] Review Salesforce token usage and renewal patterns
- [ ] Check for Atlassian API deprecation notices
- [ ] Validate SSL certificate handling still works

### Quarterly
- [ ] Rotate Atlassian API tokens per security policy
- [ ] Review Salesforce Connected App permissions
- [ ] Update documentation with any architectural changes

## 📞 Support

### Issue Priority Guidelines

**🔴 Critical (Immediate Response)**
- Authentication completely failing
- Application crashes
- Data corruption

**🟡 High (Same Day Response)**
- Partial authentication failures
- Performance degradation
- New deployment issues

**🟢 Medium (Next Business Day)**
- Feature requests
- Documentation updates
- Non-critical improvements

### Escalation Path
1. **Self-Service**: Use troubleshooting checklist and diagnostic tools
2. **Team Lead**: For configuration and environment issues
3. **DevOps**: For infrastructure and security concerns
4. **Vendor Support**: For Salesforce/Atlassian platform issues

---

## 📝 Documentation Standards

All documentation in this folder follows these standards:
- **Markdown format** for universal compatibility
- **Clear section headers** with emoji indicators
- **Code examples** with proper syntax highlighting
- **Checklists** for procedural guidance
- **Version tracking** with last updated dates

---

*For questions about this documentation, please refer to the troubleshooting guide or contact the development team.*

**Documentation Version**: 1.1  
**Last Updated**: September 30, 2025  
**Application Version**: Compatible with Deployment Assistant v1.0+
