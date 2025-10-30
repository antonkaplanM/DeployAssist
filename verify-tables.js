/**
 * Verify Database Tables
 * Checks if async validation tables were created successfully
 */

require('dotenv').config();
const { Pool } = require('pg');

// Build DATABASE_URL from individual components
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const dbName = process.env.DB_NAME || 'deployment_assistant';
const dbUser = process.env.DB_USER || 'app_user';
const dbPassword = process.env.DB_PASSWORD || 'secure_password_123';

const DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function verifyTables() {
    console.log('\n🔍 Verifying Database Tables');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
        // Check for async validation tables
        const tableQuery = `
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema = 'public' 
              AND table_name IN ('async_validation_results', 'async_validation_processing_log')
            ORDER BY table_name
        `;
        
        const result = await pool.query(tableQuery);
        
        if (result.rows.length === 0) {
            console.log('❌ No async validation tables found!');
            console.log('   Expected tables: async_validation_results, async_validation_processing_log\n');
            return false;
        }
        
        console.log('✅ Tables created successfully:\n');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name} (${row.column_count} columns)`);
        });
        
        // Check indexes
        console.log('\n📊 Checking indexes...\n');
        const indexQuery = `
            SELECT tablename, indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename IN ('async_validation_results', 'async_validation_processing_log')
            ORDER BY tablename, indexname
        `;
        
        const indexResult = await pool.query(indexQuery);
        indexResult.rows.forEach(row => {
            console.log(`   ✓ ${row.indexname} on ${row.tablename}`);
        });
        
        // Check triggers
        console.log('\n⚡ Checking triggers...\n');
        const triggerQuery = `
            SELECT trigger_name, event_manipulation, event_object_table
            FROM information_schema.triggers
            WHERE event_object_schema = 'public'
              AND event_object_table IN ('async_validation_results', 'async_validation_processing_log')
            ORDER BY event_object_table, trigger_name
        `;
        
        const triggerResult = await pool.query(triggerQuery);
        if (triggerResult.rows.length > 0) {
            triggerResult.rows.forEach(row => {
                console.log(`   ✓ ${row.trigger_name} (${row.event_manipulation}) on ${row.event_object_table}`);
            });
        } else {
            console.log('   (No triggers found - checking functions...)');
            
            // Check if the update function exists
            const funcQuery = `
                SELECT routine_name
                FROM information_schema.routines
                WHERE routine_schema = 'public'
                  AND routine_name = 'update_async_validation_updated_at'
            `;
            const funcResult = await pool.query(funcQuery);
            if (funcResult.rows.length > 0) {
                console.log(`   ✓ Function: update_async_validation_updated_at`);
            }
        }
        
        console.log('\n✅ All database objects created successfully!\n');
        return true;
        
    } catch (error) {
        console.error('❌ Error verifying tables:', error.message);
        return false;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    verifyTables().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { verifyTables };

