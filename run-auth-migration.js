require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./database');

async function runAuthMigration() {
    console.log('🔧 Starting authentication system database migration...\n');
    
    try {
        // Read the SQL migration file
        const sqlFilePath = path.join(__dirname, 'database', 'init-scripts', '07-auth-system.sql');
        console.log(`📄 Reading migration file: ${sqlFilePath}`);
        
        if (!fs.existsSync(sqlFilePath)) {
            throw new Error(`Migration file not found: ${sqlFilePath}`);
        }
        
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        console.log('✅ Migration file loaded\n');
        
        // Get database connection
        console.log('🔌 Connecting to database...');
        const client = await db.pool.connect();
        console.log('✅ Database connection established\n');
        
        try {
            // Execute the migration
            console.log('🚀 Executing migration SQL...');
            await client.query(sqlContent);
            console.log('✅ Migration executed successfully!\n');
            
            // Verify tables were created
            console.log('🔍 Verifying tables...');
            const tableCheck = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('users', 'roles', 'user_roles', 'sessions', 'audit_logs', 'failed_login_attempts')
                ORDER BY table_name
            `);
            
            const createdTables = tableCheck.rows.map(row => row.table_name);
            console.log('✅ Tables created:');
            createdTables.forEach(table => console.log(`   - ${table}`));
            
            // Check if default roles exist
            console.log('\n🔍 Verifying default roles...');
            const rolesCheck = await client.query('SELECT name FROM roles ORDER BY name');
            const roles = rolesCheck.rows.map(row => row.name);
            console.log('✅ Roles created:');
            roles.forEach(role => console.log(`   - ${role}`));
            
            console.log('\n✨ Authentication system database migration complete!');
            console.log('\n📋 Next steps:');
            console.log('   1. Run: node setup-admin-user.js');
            console.log('   2. Run: npm start');
            console.log('   3. Visit: http://localhost:8080\n');
            
        } finally {
            client.release();
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nError details:', error);
        
        if (error.message.includes('relation') && error.message.includes('already exists')) {
            console.log('\n⚠️  Tables already exist. This is normal if you ran the migration before.');
            console.log('   You can proceed to the next step: node setup-admin-user.js\n');
            process.exit(0);
        }
        
        process.exit(1);
    }
}

// Run the migration
runAuthMigration();

