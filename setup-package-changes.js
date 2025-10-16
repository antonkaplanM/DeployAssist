// Package Changes Database Setup Script
// This script creates the package_change_analysis tables for tracking package upgrades/downgrades
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

async function setupPackageChanges() {
    const client = new Client(DB_CONFIG);

    try {
        console.log('🔌 Connecting to PostgreSQL...');
        console.log(`   Host: ${DB_CONFIG.host}`);
        console.log(`   Database: ${DB_CONFIG.database}`);
        console.log(`   User: ${DB_CONFIG.user}\n`);
        
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // Step 1: Create package_change_analysis table
        console.log('📊 Step 1: Creating package_change_analysis table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS package_change_analysis (
                id SERIAL PRIMARY KEY,
                analysis_date TIMESTAMP NOT NULL,
                ps_record_id VARCHAR(50) NOT NULL,
                ps_record_name VARCHAR(100) NOT NULL,
                previous_ps_record_id VARCHAR(50) NOT NULL,
                previous_ps_record_name VARCHAR(100) NOT NULL,
                deployment_number VARCHAR(100) NOT NULL,
                account_id VARCHAR(255),
                account_name VARCHAR(255) NOT NULL,
                account_site VARCHAR(255),
                product_code VARCHAR(100) NOT NULL,
                product_name VARCHAR(255),
                previous_package VARCHAR(100) NOT NULL,
                new_package VARCHAR(100) NOT NULL,
                change_type VARCHAR(20) NOT NULL,
                previous_start_date DATE,
                previous_end_date DATE,
                new_start_date DATE,
                new_end_date DATE,
                ps_created_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ package_change_analysis table created!\n');

        // Step 2: Create package_change_analysis_log table
        console.log('📊 Step 2: Creating package_change_analysis_log table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS package_change_analysis_log (
                id SERIAL PRIMARY KEY,
                analysis_started TIMESTAMP NOT NULL,
                analysis_completed TIMESTAMP NOT NULL,
                records_analyzed INT NOT NULL DEFAULT 0,
                deployments_processed INT NOT NULL DEFAULT 0,
                changes_found INT NOT NULL DEFAULT 0,
                upgrades_found INT NOT NULL DEFAULT 0,
                downgrades_found INT NOT NULL DEFAULT 0,
                ps_records_with_changes INT NOT NULL DEFAULT 0,
                accounts_affected INT NOT NULL DEFAULT 0,
                lookback_years INT DEFAULT 2,
                start_date DATE,
                end_date DATE,
                status VARCHAR(50) NOT NULL DEFAULT 'completed',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ package_change_analysis_log table created!\n');

        // Step 3: Create indexes
        console.log('📑 Step 3: Creating indexes...');
        
        const indexes = [
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_analysis_date', 
                column: 'analysis_date DESC' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_ps_record', 
                column: 'ps_record_id' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_deployment', 
                column: 'deployment_number' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_account', 
                column: 'account_id' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_product', 
                column: 'product_code' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_type', 
                column: 'change_type' 
            },
            { 
                table: 'package_change_analysis',
                name: 'idx_package_change_ps_created', 
                column: 'ps_created_date DESC' 
            },
            { 
                table: 'package_change_analysis_log',
                name: 'idx_package_change_log_completed', 
                column: 'analysis_completed DESC' 
            }
        ];

        for (const index of indexes) {
            await client.query(`
                CREATE INDEX IF NOT EXISTS ${index.name} 
                ON ${index.table}(${index.column})
            `);
            console.log(`   ✅ Created index: ${index.name}`);
        }
        console.log('');

        // Step 4: Add comments
        console.log('💬 Step 4: Adding table comments...');
        await client.query(`
            COMMENT ON TABLE package_change_analysis IS 
            'Tracks package name changes (upgrades/downgrades) across PS records within deployments'
        `);
        await client.query(`
            COMMENT ON COLUMN package_change_analysis.change_type IS 
            'Type of change: upgrade or downgrade'
        `);
        await client.query(`
            COMMENT ON COLUMN package_change_analysis.deployment_number IS 
            'Deployment identifier (e.g., deploy-7561) from Deployment__r.Name'
        `);
        await client.query(`
            COMMENT ON TABLE package_change_analysis_log IS 
            'Log of package change analysis runs with summary statistics'
        `);
        console.log('   ✅ Table comments added!\n');

        // Step 5: Verify setup
        console.log('🧪 Step 5: Verifying setup...');
        
        const analysisTable = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'package_change_analysis'
        `);
        console.log(`   ✅ package_change_analysis table exists: ${analysisTable.rows[0].count > 0}`);
        
        const logTable = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'package_change_analysis_log'
        `);
        console.log(`   ✅ package_change_analysis_log table exists: ${logTable.rows[0].count > 0}`);
        
        const indexCount = await client.query(`
            SELECT COUNT(*) FROM pg_indexes 
            WHERE tablename IN ('package_change_analysis', 'package_change_analysis_log')
        `);
        console.log(`   ✅ Created ${indexCount.rows[0].count} indexes\n`);

        console.log('✅ Package Changes database setup completed successfully!\n');
        console.log('📝 Next steps:');
        console.log('   1. Navigate to Analytics > Package Changes in the app');
        console.log('   2. Click "Refresh Analysis" to analyze package changes');
        console.log('   3. View insights on upgrades and downgrades\n');

    } catch (error) {
        console.error('❌ Error during setup:', error.message);
        console.error('\n🔍 Troubleshooting:');
        console.error('   1. Make sure PostgreSQL is running');
        console.error('   2. Verify your .env file has correct database credentials');
        console.error('   3. Check that the database "deployment_assistant" exists');
        console.error('   4. Run "node setup-database.js" first if needed\n');
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the setup
console.log('🚀 Starting Package Changes Database Setup...\n');
setupPackageChanges()
    .then(() => {
        console.log('🎉 Setup complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Setup failed:', error);
        process.exit(1);
    });

