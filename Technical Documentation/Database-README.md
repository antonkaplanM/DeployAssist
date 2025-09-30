# Database Documentation

This directory contains database-related configuration, scripts, and documentation for the hello-world-nodejs application.

## Quick Links

- **[PostgreSQL Setup Complete](./PostgreSQL-Setup-Complete.md)** - Full setup guide and API reference
- **[Windows Database Setup Guide](./Windows-Database-Setup-Guide.md)** - Installation instructions for Windows
- **[Init Scripts](./init-scripts/)** - Database initialization SQL scripts

## Current Setup

- **Database:** PostgreSQL 16.8
- **Connection Status:** ✅ Connected
- **Database Name:** `deployment_assistant`
- **Health Check:** `GET http://localhost:8080/api/health/database`

## Quick Start

```javascript
// In your app code
const db = require('./database');

// Execute a query
const result = await db.query('SELECT * FROM users');

// Use a transaction
await db.transaction(async (client) => {
    await client.query('INSERT INTO users (name) VALUES ($1)', ['John']);
});

// Test connection
const status = await db.testConnection();
console.log(status);
```

## Files

- `init-scripts/` - SQL scripts that run on database initialization
- `PostgreSQL-Setup-Complete.md` - Complete setup documentation
- `Windows-Database-Setup-Guide.md` - Windows-specific installation guide
- `install-windows-databases.ps1` - Automated installation script for Windows

## Support

For issues or questions, refer to the PostgreSQL Setup Complete documentation or the PostgreSQL official documentation.
