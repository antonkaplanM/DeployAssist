require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

async function findMAContractLink() {
    try {
        console.log('🔍 Searching for MA_ContractLink__c field...\n');
        
        const conn = await salesforce.getConnection();
        
        // Check Prof_Services_Request__c first
        console.log('1. Checking Prof_Services_Request__c...');
        try {
            const psDescribe = await conn.sobject('Prof_Services_Request__c').describe();
            const contractLinkField = psDescribe.fields.find(f => f.name === 'MA_ContractLink__c');
            
            if (contractLinkField) {
                console.log('   ✅ Found MA_ContractLink__c in Prof_Services_Request__c!');
                console.log('      Type:', contractLinkField.type);
                console.log('      Label:', contractLinkField.label);
                
                // Query a PIMCO record to see the value
                console.log('\n   Testing with PIMCO record...');
                const query = `
                    SELECT Id, Name, Account__c, MA_ContractLink__c
                    FROM Prof_Services_Request__c
                    WHERE Account__c = 'Pacific Investment Management Company LLC (PIMCO)'
                    AND MA_ContractLink__c != null
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                `;
                
                const result = await conn.query(query);
                
                if (result.records.length > 0) {
                    const record = result.records[0];
                    console.log('\n   ✅ Found record:', record.Name);
                    console.log('      MA_ContractLink__c:', record.MA_ContractLink__c);
                    
                    // Extract the part after RelayState=
                    if (record.MA_ContractLink__c && record.MA_ContractLink__c.includes('RelayState=')) {
                        const relayStateValue = record.MA_ContractLink__c.split('RelayState=')[1];
                        console.log('\n   🎯 Value after RelayState=:', relayStateValue);
                        console.log('   🔗 MA SF Link: https://moodysanalytics.my.salesforce.com/' + relayStateValue);
                    }
                } else {
                    console.log('   ⚠️  No PIMCO records found with MA_ContractLink__c populated');
                    
                    // Try any record
                    console.log('\n   Trying any record with MA_ContractLink__c...');
                    const query2 = `
                        SELECT Id, Name, Account__c, MA_ContractLink__c
                        FROM Prof_Services_Request__c
                        WHERE MA_ContractLink__c != null
                        ORDER BY CreatedDate DESC
                        LIMIT 1
                    `;
                    const result2 = await conn.query(query2);
                    
                    if (result2.records.length > 0) {
                        const record2 = result2.records[0];
                        console.log('\n   ✅ Found record:', record2.Name);
                        console.log('      Account:', record2.Account__c);
                        console.log('      MA_ContractLink__c:', record2.MA_ContractLink__c);
                        
                        if (record2.MA_ContractLink__c.includes('RelayState=')) {
                            const relayStateValue = record2.MA_ContractLink__c.split('RelayState=')[1];
                            console.log('\n   🎯 Value after RelayState=:', relayStateValue);
                            console.log('   🔗 MA SF Link: https://moodysanalytics.my.salesforce.com/' + relayStateValue);
                        }
                    }
                }
            } else {
                console.log('   ❌ MA_ContractLink__c NOT found in Prof_Services_Request__c');
            }
        } catch (err) {
            console.log('   ❌ Error:', err.message.split('\n')[0]);
        }
        
        // Check other objects
        console.log('\n2. Checking other custom objects...');
        const global = await conn.describeGlobal();
        const customObjects = global.sobjects.filter(obj => obj.name.endsWith('__c'));
        
        for (const obj of customObjects.slice(0, 20)) {
            try {
                const describe = await conn.sobject(obj.name).describe();
                const hasField = describe.fields.some(f => f.name === 'MA_ContractLink__c');
                
                if (hasField) {
                    console.log(`   ✅ Found in ${obj.name}!`);
                }
            } catch (err) {
                // Silent fail
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

findMAContractLink();

