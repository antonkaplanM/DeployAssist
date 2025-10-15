require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

async function testAccountAccess() {
    try {
        console.log('🔍 Testing Account object access with updated permissions...\n');
        
        const conn = await salesforce.getConnection();
        
        // Test 1: Can we query Account object now?
        console.log('Test 1: Querying Account object...');
        try {
            const testQuery = `SELECT Id, Name, MA_AccountID__c FROM Account LIMIT 1`;
            const result = await conn.query(testQuery);
            
            console.log('✅ SUCCESS! Account object is now accessible!');
            console.log(`   Found ${result.totalSize} records`);
            
            if (result.records.length > 0) {
                const account = result.records[0];
                console.log('\n   Sample record:');
                console.log('   Id:', account.Id);
                console.log('   Name:', account.Name);
                console.log('   MA_AccountID__c:', account.MA_AccountID__c);
            }
        } catch (err) {
            console.log('❌ FAILED:', err.message.split('\n')[0]);
            console.log('   Account object is still not accessible');
            return;
        }
        
        // Test 2: Query PIMCO account specifically
        console.log('\n\nTest 2: Querying PIMCO account...');
        try {
            const pimocoQuery = `
                SELECT Id, Name, MA_AccountID__c
                FROM Account
                WHERE Name = 'Pacific Investment Management Company LLC (PIMCO)'
                LIMIT 1
            `;
            
            const result = await conn.query(pimocoQuery);
            
            if (result.records.length > 0) {
                const account = result.records[0];
                console.log('✅ Found PIMCO account!');
                console.log('   Id:', account.Id);
                console.log('   Name:', account.Name);
                console.log('   MA_AccountID__c:', account.MA_AccountID__c);
                console.log('\n🎯 Expected MA_AccountID__c: 0014000000NXxAnAAL');
                console.log('   Matches:', account.MA_AccountID__c === '0014000000NXxAnAAL' ? '✅ YES' : '❌ NO');
                console.log('\n🔗 MA SF Link:', `https://moodysanalytics.my.salesforce.com/${account.MA_AccountID__c}`);
            } else {
                console.log('⚠️  PIMCO account not found');
            }
        } catch (err) {
            console.log('❌ Query failed:', err.message.split('\n')[0]);
        }
        
        // Test 3: Query using Account_Salesforce_ID__c (the Account Id from PS records)
        console.log('\n\nTest 3: Querying Account by Id (from PS record)...');
        try {
            const accountId = '0016Q0000240AAbQAM'; // From PS record
            const query = `
                SELECT Id, Name, MA_AccountID__c
                FROM Account
                WHERE Id = '${accountId}'
            `;
            
            const result = await conn.query(query);
            
            if (result.records.length > 0) {
                const account = result.records[0];
                console.log('✅ Found account by Id!');
                console.log('   Id:', account.Id);
                console.log('   Name:', account.Name);
                console.log('   MA_AccountID__c:', account.MA_AccountID__c);
                console.log('\n💡 We can use Account_Salesforce_ID__c from PS records to query Account.MA_AccountID__c!');
            } else {
                console.log('⚠️  Account not found with that Id');
            }
        } catch (err) {
            console.log('❌ Query failed:', err.message.split('\n')[0]);
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('\n✅ CONCLUSION: Account object is now accessible!');
        console.log('   We can revert to the simpler approach:');
        console.log('   1. Get Account_Salesforce_ID__c from Prof_Services_Request__c');
        console.log('   2. Query Account object using that Id');
        console.log('   3. Get MA_AccountID__c field');
        console.log('   4. Build MA SF Link');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testAccountAccess();

