# PostgreSQL Quick Reference

## Connection Details
```
Host:     localhost
Port:     5432
Database: deployment_assistant
User:     app_user
Password: secure_password_123
```

## Test Connection
```bash
# Via API
curl http://localhost:8080/api/health/database

# Via psql command line
psql -h localhost -U app_user -d deployment_assistant
```

## Common Operations

### Import Database Module
```javascript
const db = require('./database');
```

### Execute Query
```javascript
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
const users = result.rows;
```

### Create Table
```javascript
await db.query(`
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )
`);
```

### Insert Data
```javascript
const result = await db.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    ['John Doe', 'john@example.com']
);
```

### Transaction
```javascript
await db.transaction(async (client) => {
    await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
    await client.query('INSERT INTO logs (action) VALUES ($1)', ['user_created']);
});
```

### Check Connection
```javascript
const status = await db.testConnection();
// { success: true, connected: true, database: 'deployment_assistant', ... }
```

### Pool Stats
```javascript
const stats = db.getPoolStats();
// { totalCount: 1, idleCount: 1, waitingCount: 0 }
```

## Environment Variables
Add to `.env`:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deployment_assistant
DB_USER=app_user
DB_PASSWORD=secure_password_123
```

## Useful SQL Commands

### List Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Describe Table
```sql
\d table_name
```

### Show Database Size
```sql
SELECT pg_size_pretty(pg_database_size('deployment_assistant'));
```

### List Active Connections
```sql
SELECT * FROM pg_stat_activity 
WHERE datname = 'deployment_assistant';
```
