// PostgreSQL Database Setup Script
// This script creates the deployment_assistant database and app_user
const { Client } = require('pg');

const POSTGRES_PASSWORD = process.env.PGPASSWORD || 'postgres';
const APP_USER_PASSWORD = 'secure_password_123';

async function setupDatabase() {
    // Connect to default postgres database as superuser
    const superuserClient = new Client({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: POSTGRES_PASSWORD
    });

    try {
        console.log('🔌 Connecting to PostgreSQL as superuser...\n');
        await superuserClient.connect();
        console.log('✅ Connected successfully!\n');

        // Step 1: Check if database exists
        console.log('📊 Step 1: Checking if deployment_assistant database exists...');
        const dbCheckResult = await superuserClient.query(
            "SELECT 1 FROM pg_database WHERE datname = 'deployment_assistant'"
        );

        if (dbCheckResult.rows.length > 0) {
            console.log('   ℹ️  Database already exists');
        } else {
            console.log('   Creating deployment_assistant database...');
            await superuserClient.query('CREATE DATABASE deployment_assistant WITH ENCODING = \'UTF8\'');
            console.log('   ✅ Database created successfully!');
        }

        // Step 2: Check if user exists
        console.log('\n👤 Step 2: Checking if app_user exists...');
        const userCheckResult = await superuserClient.query(
            "SELECT 1 FROM pg_roles WHERE rolname = 'app_user'"
        );

        if (userCheckResult.rows.length > 0) {
            console.log('   ℹ️  User already exists');
            // Update password just in case
            await superuserClient.query(`ALTER USER app_user WITH PASSWORD '${APP_USER_PASSWORD}'`);
            console.log('   ✅ Password updated');
        } else {
            console.log('   Creating app_user...');
            await superuserClient.query(
                `CREATE USER app_user WITH PASSWORD '${APP_USER_PASSWORD}'`
            );
            console.log('   ✅ User created successfully!');
        }

        // Grant privileges on the database
        console.log('\n🔐 Step 3: Granting privileges...');
        await superuserClient.query('GRANT ALL PRIVILEGES ON DATABASE deployment_assistant TO app_user');
        console.log('   ✅ Database privileges granted!');

        await superuserClient.end();

        // Step 4: Connect to deployment_assistant database to set up schema
        console.log('\n🔧 Step 4: Setting up database schema...');
        const appClient = new Client({
            host: 'localhost',
            port: 5432,
            database: 'deployment_assistant',
            user: 'postgres',
            password: POSTGRES_PASSWORD
        });

        await appClient.connect();

        // Grant schema privileges
        await appClient.query('GRANT ALL ON SCHEMA public TO app_user');
        await appClient.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user');
        await appClient.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user');
        
        // Set default privileges for future tables
        await appClient.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user');
        await appClient.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user');
        
        console.log('   ✅ Schema privileges granted!');

        // Create UUID extension
        console.log('\n🔌 Step 5: Installing PostgreSQL extensions...');
        await appClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('   ✅ uuid-ossp extension installed!');

        // Verify setup
        console.log('\n🧪 Step 6: Verifying setup...');
        const version = await appClient.query('SELECT version()');
        console.log('   PostgreSQL Version:', version.rows[0].version.split(',')[0]);

        const extensions = await appClient.query(
            "SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'"
        );
        console.log('   Extensions:', extensions.rows.map(r => r.extname).join(', '));

        await appClient.end();

        // Step 7: Test connection as app_user
        console.log('\n✅ Step 7: Testing connection as app_user...');
        const testClient = new Client({
            host: 'localhost',
            port: 5432,
            database: 'deployment_assistant',
            user: 'app_user',
            password: APP_USER_PASSWORD
        });

        await testClient.connect();
        const testResult = await testClient.query('SELECT current_user, current_database()');
        console.log(`   ✅ Connected as: ${testResult.rows[0].current_user}`);
        console.log(`   ✅ Database: ${testResult.rows[0].current_database}`);
        
        // Test UUID generation
        const uuidTest = await testClient.query('SELECT uuid_generate_v4() as test_uuid');
        console.log(`   ✅ UUID generation working: ${uuidTest.rows[0].test_uuid}`);
        
        await testClient.end();

        console.log('\n' + '='.repeat(60));
        console.log('🎉 DATABASE SETUP COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\nConnection details:');
        console.log('  Host:     localhost');
        console.log('  Port:     5432');
        console.log('  Database: deployment_assistant');
        console.log('  User:     app_user');
        console.log('  Password: secure_password_123');
        console.log('\nYou can now use these credentials in your .env file.');
        console.log('='.repeat(60) + '\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error during database setup:', error.message);
        console.error('\nFull error:', error);
        return { success: false, error: error.message };
    }
}

// Run the setup
setupDatabase()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
