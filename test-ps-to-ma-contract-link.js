require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

async function testPSToMAContractLink() {
    try {
        console.log('🔍 Testing link from PS records to MA_Contract...\n');
        
        const conn = await salesforce.getConnection();
        
        // Get a PIMCO PS record
        const psQuery = `
            SELECT Id, Name, Account__c, Contract_RI__c
            FROM Prof_Services_Request__c
            WHERE Account__c = 'Pacific Investment Management Company LLC (PIMCO)'
            ORDER BY CreatedDate DESC
            LIMIT 1
        `;
        
        console.log('Querying PIMCO PS record...');
        const psResult = await conn.query(psQuery);
        
        if (psResult.records.length > 0) {
            const psRecord = psResult.records[0];
            console.log('✅ Found PS record:', psRecord.Name);
            console.log('   Account:', psRecord.Account__c);
            console.log('   Contract_RI__c:', psRecord.Contract_RI__c);
            
            if (psRecord.Contract_RI__c) {
                // Try to find MA_Contract with this ID
                console.log('\n🔍 Looking for MA_Contract with Contract_RI__c:', psRecord.Contract_RI__c);
                
                const contractQuery = `
                    SELECT Id, Name, MA_Account_External_ID__c, MA_ContractLink__c
                    FROM MA_Contract__c
                    WHERE ContractId__c = '${psRecord.Contract_RI__c}'
                       OR PS_External_Contract_Id__c = '${psRecord.Contract_RI__c}'
                    LIMIT 1
                `;
                
                const contractResult = await conn.query(contractQuery);
                
                if (contractResult.records.length > 0) {
                    const contract = contractResult.records[0];
                    console.log('✅ Found MA_Contract:', contract.Name);
                    console.log('   MA_Account_External_ID__c:', contract.MA_Account_External_ID__c);
                    console.log('   MA_ContractLink__c:', contract.MA_ContractLink__c.substring(0, 150) + '...');
                    
                    // Extract RelayState
                    if (contract.MA_ContractLink__c && contract.MA_ContractLink__c.includes('RelayState=')) {
                        const relayStatePart = contract.MA_ContractLink__c.split('RelayState=')[1];
                        const cleanUrl = relayStatePart.split('"')[0]; // Extract until first quote
                        
                        console.log('\n🎯 Extracted URL:', cleanUrl);
                        
                        // Can use either the Account ID or the Contract link
                        console.log('\n📌 Two options for MA SF Link:');
                        console.log('   1. Using MA Account ID:', `https://moodysanalytics.my.salesforce.com/${contract.MA_Account_External_ID__c}`);
                        console.log('   2. Using RelayState URL:', cleanUrl);
                    }
                } else {
                    console.log('⚠️  No MA_Contract found for this Contract_RI__c');
                }
            } else {
                console.log('⚠️  PS record has no Contract_RI__c value');
            }
        } else {
            console.log('⚠️  No PIMCO PS record found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPSToMAContractLink();

