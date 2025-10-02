// Expiration Monitor Database Setup Script
// This script creates the expiration_monitor and expiration_analysis_log tables
require('dotenv').config();
const { Client } = require('pg');

// Use environment variables or defaults
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'secure_password_123'
};

async function setupExpirationMonitor() {
    const client = new Client(DB_CONFIG);

    try {
        console.log('🔌 Connecting to PostgreSQL...');
        console.log(`   Host: ${DB_CONFIG.host}`);
        console.log(`   Database: ${DB_CONFIG.database}`);
        console.log(`   User: ${DB_CONFIG.user}\n`);
        
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // Step 1: Create expiration_monitor table
        console.log('📊 Step 1: Creating expiration_monitor table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS expiration_monitor (
                id SERIAL PRIMARY KEY,
                account_id VARCHAR(255) NOT NULL,
                account_name VARCHAR(255),
                ps_record_id VARCHAR(255) NOT NULL,
                ps_record_name VARCHAR(100) NOT NULL,
                product_code VARCHAR(100) NOT NULL,
                product_name VARCHAR(255),
                product_type VARCHAR(50) NOT NULL,
                end_date DATE NOT NULL,
                is_extended BOOLEAN DEFAULT FALSE,
                extending_ps_record_id VARCHAR(255),
                extending_ps_record_name VARCHAR(100),
                extending_end_date DATE,
                days_until_expiry INT,
                last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ expiration_monitor table created!\n');

        // Step 2: Create indexes
        console.log('📑 Step 2: Creating indexes...');
        
        const indexes = [
            { name: 'idx_expiration_end_date', column: 'end_date' },
            { name: 'idx_expiration_account_id', column: 'account_id' },
            { name: 'idx_expiration_product_code', column: 'product_code' },
            { name: 'idx_expiration_is_extended', column: 'is_extended' },
            { name: 'idx_expiration_days_until_expiry', column: 'days_until_expiry' },
            { name: 'idx_expiration_ps_record', column: 'ps_record_id' }
        ];

        for (const index of indexes) {
            await client.query(`
                CREATE INDEX IF NOT EXISTS ${index.name} 
                ON expiration_monitor(${index.column})
            `);
            console.log(`   ✅ Created index: ${index.name}`);
        }
        console.log('');

        // Step 3: Create expiration_analysis_log table
        console.log('📊 Step 3: Creating expiration_analysis_log table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS expiration_analysis_log (
                id SERIAL PRIMARY KEY,
                analysis_started TIMESTAMP,
                analysis_completed TIMESTAMP,
                records_analyzed INT,
                entitlements_processed INT,
                expirations_found INT,
                extensions_found INT,
                lookback_years INT DEFAULT 5,
                status VARCHAR(50),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ expiration_analysis_log table created!\n');

        // Step 4: Create index for analysis log
        console.log('📑 Step 4: Creating analysis log index...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_analysis_log_created 
            ON expiration_analysis_log(created_at DESC)
        `);
        console.log('   ✅ Created index: idx_analysis_log_created\n');

        // Step 5: Add comments
        console.log('💬 Step 5: Adding table comments...');
        await client.query(`
            COMMENT ON TABLE expiration_monitor IS 
            'Cached expiration data for product entitlements from Professional Services requests'
        `);
        await client.query(`
            COMMENT ON TABLE expiration_analysis_log IS 
            'Log of expiration analysis runs for monitoring and debugging'
        `);
        await client.query(`
            COMMENT ON COLUMN expiration_monitor.is_extended IS 
            'TRUE if this expiring entitlement has an extension in another PS record for the same account'
        `);
        await client.query(`
            COMMENT ON COLUMN expiration_monitor.days_until_expiry IS 
            'Calculated days from analysis date to end_date'
        `);
        await client.query(`
            COMMENT ON COLUMN expiration_analysis_log.status IS 
            'Status of analysis run: running, completed, failed'
        `);
        console.log('   ✅ Comments added!\n');

        // Step 6: Insert initial log entry
        console.log('📝 Step 6: Inserting initial log entry...');
        await client.query(`
            INSERT INTO expiration_analysis_log (
                analysis_started,
                analysis_completed,
                status,
                records_analyzed,
                entitlements_processed,
                expirations_found,
                extensions_found
            ) VALUES (
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                'schema_initialized',
                0,
                0,
                0,
                0
            )
        `);
        console.log('   ✅ Initial log entry created!\n');

        // Step 7: Verify setup
        console.log('🧪 Step 7: Verifying setup...');
        
        const monitorCheck = await client.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'expiration_monitor'
        `);
        console.log(`   ✅ expiration_monitor table exists: ${monitorCheck.rows[0].count > 0}`);

        const logCheck = await client.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'expiration_analysis_log'
        `);
        console.log(`   ✅ expiration_analysis_log table exists: ${logCheck.rows[0].count > 0}`);

        const indexCount = await client.query(`
            SELECT COUNT(*) as count FROM pg_indexes 
            WHERE tablename IN ('expiration_monitor', 'expiration_analysis_log')
        `);
        console.log(`   ✅ Total indexes created: ${indexCount.rows[0].count}`);

        const logEntryCount = await client.query(`
            SELECT COUNT(*) as count FROM expiration_analysis_log
        `);
        console.log(`   ✅ Log entries: ${logEntryCount.rows[0].count}\n`);

        await client.end();

        console.log('='.repeat(60));
        console.log('🎉 EXPIRATION MONITOR SETUP COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\nTables created:');
        console.log('  ✓ expiration_monitor (with 6 indexes)');
        console.log('  ✓ expiration_analysis_log (with 1 index)');
        console.log('\nNext steps:');
        console.log('  1. Start your application');
        console.log('  2. Navigate to Provisioning → Expiration Monitor');
        console.log('  3. Click "Refresh Analysis" to populate data');
        console.log('='.repeat(60) + '\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error during expiration monitor setup:', error.message);
        console.error('\nFull error:', error);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Make sure PostgreSQL is running and accessible.');
        } else if (error.code === '28P01') {
            console.error('\n💡 Check your database credentials in .env file.');
        }
        
        return { success: false, error: error.message };
    }
}

// Run the setup
if (require.main === module) {
    setupExpirationMonitor()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { setupExpirationMonitor };

