// Test database connection from the app
require('dotenv').config();
const db = require('./database');

async function testAppDatabaseConnection() {
    console.log('🧪 Testing Database Connection from Application\n');
    console.log('='.repeat(60));
    
    try {
        // Test 1: Basic connection
        console.log('\n📊 Test 1: Basic Connection Test');
        const connectionTest = await db.testConnection();
        
        if (connectionTest.success) {
            console.log('   ✅ Connection successful!');
            console.log(`   Database: ${connectionTest.database}`);
            console.log(`   User: ${connectionTest.user}`);
            console.log(`   Timestamp: ${connectionTest.timestamp}`);
        } else {
            console.log('   ❌ Connection failed:', connectionTest.error);
            return { success: false };
        }
        
        // Test 2: Simple query
        console.log('\n📊 Test 2: Simple Query Test');
        const queryResult = await db.query('SELECT version() as version, current_database() as db');
        console.log('   ✅ Query executed successfully!');
        console.log(`   PostgreSQL Version: ${queryResult.rows[0].version.split(',')[0]}`);
        console.log(`   Current Database: ${queryResult.rows[0].db}`);
        
        // Test 3: UUID generation
        console.log('\n📊 Test 3: UUID Generation Test');
        const uuidResult = await db.query('SELECT uuid_generate_v4() as test_uuid');
        console.log('   ✅ UUID extension working!');
        console.log(`   Sample UUID: ${uuidResult.rows[0].test_uuid}`);
        
        // Test 4: Pool statistics
        console.log('\n📊 Test 4: Connection Pool Statistics');
        const poolStats = db.getPoolStats();
        console.log('   Total connections:', poolStats.totalCount);
        console.log('   Idle connections:', poolStats.idleCount);
        console.log('   Waiting connections:', poolStats.waitingCount);
        
        // Test 5: Transaction support
        console.log('\n📊 Test 5: Transaction Test');
        const txResult = await db.transaction(async (client) => {
            await client.query('SELECT 1 as test');
            return { success: true };
        });
        console.log('   ✅ Transaction executed successfully!');
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ALL DATABASE TESTS PASSED!');
        console.log('='.repeat(60));
        console.log('\n✅ Your application can now connect to PostgreSQL');
        console.log('✅ Database module is ready to use in app.js\n');
        
        return { success: true };
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('\nFull error:', error);
        return { success: false, error: error.message };
        
    } finally {
        // Close the pool
        await db.closePool();
    }
}

// Run the test
testAppDatabaseConnection()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
