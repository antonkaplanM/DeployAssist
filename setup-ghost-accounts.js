// Ghost Accounts Database Setup Script
// This script creates the ghost_accounts table for tracking accounts with all products expired
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

async function setupGhostAccounts() {
    const client = new Client(DB_CONFIG);

    try {
        console.log('🔌 Connecting to PostgreSQL...');
        console.log(`   Host: ${DB_CONFIG.host}`);
        console.log(`   Database: ${DB_CONFIG.database}`);
        console.log(`   User: ${DB_CONFIG.user}\n`);
        
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // Step 1: Create ghost_accounts table
        console.log('📊 Step 1: Creating ghost_accounts table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS ghost_accounts (
                id SERIAL PRIMARY KEY,
                account_id VARCHAR(255) NOT NULL UNIQUE,
                account_name VARCHAR(255) NOT NULL,
                total_expired_products INT NOT NULL,
                latest_expiry_date DATE NOT NULL,
                last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_reviewed BOOLEAN DEFAULT FALSE,
                reviewed_at TIMESTAMP,
                reviewed_by VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ ghost_accounts table created!\n');

        // Step 2: Create indexes
        console.log('📑 Step 2: Creating indexes...');
        
        const indexes = [
            { name: 'idx_ghost_accounts_account_id', column: 'account_id' },
            { name: 'idx_ghost_accounts_is_reviewed', column: 'is_reviewed' },
            { name: 'idx_ghost_accounts_latest_expiry', column: 'latest_expiry_date' },
            { name: 'idx_ghost_accounts_last_checked', column: 'last_checked DESC' }
        ];

        for (const index of indexes) {
            await client.query(`
                CREATE INDEX IF NOT EXISTS ${index.name} 
                ON ghost_accounts(${index.column})
            `);
            console.log(`   ✅ Created index: ${index.name}`);
        }
        console.log('');

        // Step 3: Add comments
        console.log('💬 Step 3: Adding table comments...');
        await client.query(`
            COMMENT ON TABLE ghost_accounts IS 
            'Tracks accounts with all products expired but no deprovisioning PS record'
        `);
        await client.query(`
            COMMENT ON COLUMN ghost_accounts.account_id IS 
            'Salesforce Account ID'
        `);
        await client.query(`
            COMMENT ON COLUMN ghost_accounts.is_reviewed IS 
            'TRUE if an administrator has reviewed this ghost account'
        `);
        await client.query(`
            COMMENT ON COLUMN ghost_accounts.latest_expiry_date IS 
            'The most recent expiration date among all expired entitlements'
        `);
        await client.query(`
            COMMENT ON COLUMN ghost_accounts.last_checked IS 
            'When this account was last analyzed for ghost status'
        `);
        console.log('   ✅ Comments added!\n');

        // Step 4: Verify setup
        console.log('🧪 Step 4: Verifying setup...');
        
        const tableCheck = await client.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_name = 'ghost_accounts'
        `);
        console.log(`   ✅ ghost_accounts table exists: ${tableCheck.rows[0].count > 0}`);

        const indexCount = await client.query(`
            SELECT COUNT(*) as count FROM pg_indexes 
            WHERE tablename = 'ghost_accounts'
        `);
        console.log(`   ✅ Total indexes created: ${indexCount.rows[0].count}\n`);

        await client.end();

        console.log('='.repeat(60));
        console.log('🎉 GHOST ACCOUNTS SETUP COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\nTable created:');
        console.log('  ✓ ghost_accounts (with 4 indexes)');
        console.log('\nNext steps:');
        console.log('  1. Start your application');
        console.log('  2. Navigate to Provisioning → Ghost Accounts');
        console.log('  3. The page will automatically analyze accounts');
        console.log('='.repeat(60) + '\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error during ghost accounts setup:', error.message);
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
    setupGhostAccounts()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { setupGhostAccounts };

