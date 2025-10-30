/**
 * Database Migration Runner
 * Runs SQL migration scripts using Node.js pg library
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Build DATABASE_URL from individual components if not set
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'deployment_assistant';
    const dbUser = process.env.DB_USER || 'app_user';
    const dbPassword = process.env.DB_PASSWORD || 'secure_password_123';
    
    DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
    console.log(`✓ Built DATABASE_URL from components: postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}`);
}

// Create database connection pool
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration(sqlFilePath) {
    console.log(`\n🔧 Running migration: ${path.basename(sqlFilePath)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Read SQL file
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Execute SQL
        console.log('📊 Executing SQL...');
        await pool.query(sql);
        
        console.log('✅ Migration completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nError details:');
        console.error('  Code:', error.code);
        console.error('  Position:', error.position);
        if (error.detail) {
            console.error('  Detail:', error.detail);
        }
        if (error.hint) {
            console.error('  Hint:', error.hint);
        }
        return false;
    }
}

async function main() {
    const migrationFile = process.argv[2] || 'database/init-scripts/13-async-validation-results.sql';
    
    console.log('\n🗄️  Database Migration Runner');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    // Test database connection
    console.log('🔌 Testing database connection...');
    try {
        const result = await pool.query('SELECT NOW() as now, current_database() as db, current_user as user');
        console.log('✅ Database connection successful!');
        console.log(`   Database: ${result.rows[0].db}`);
        console.log(`   User: ${result.rows[0].user}`);
        console.log(`   Time: ${result.rows[0].now}`);
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('\nPlease check:');
        console.error('  1. PostgreSQL is running');
        console.error('  2. Database credentials in .env are correct');
        console.error('  3. Database exists (run: createdb deployment_assistant)');
        console.error('  4. User has proper permissions');
        process.exit(1);
    }
    
    // Check if migration file exists
    if (!fs.existsSync(migrationFile)) {
        console.error(`\n❌ Migration file not found: ${migrationFile}`);
        process.exit(1);
    }
    
    // Run migration
    const success = await runMigration(migrationFile);
    
    // Close pool
    await pool.end();
    
    if (success) {
        console.log('\n🎉 All migrations completed successfully!\n');
        process.exit(0);
    } else {
        console.log('\n❌ Migration failed. Please fix errors and try again.\n');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };

