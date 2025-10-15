require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

async function investigateMAContract() {
    try {
        console.log('🔍 Investigating MA_Contract__c object...\n');
        
        const conn = await salesforce.getConnection();
        
        // Describe the object
        const describe = await conn.sobject('MA_Contract__c').describe();
        
        console.log('📋 MA_Contract__c fields related to Account/Contract/Link:\n');
        const relevantFields = describe.fields.filter(f => 
            f.name.toLowerCase().includes('account') ||
            f.name.toLowerCase().includes('contract') ||
            f.name.toLowerCase().includes('link') ||
            f.name.toLowerCase().includes('ma_') ||
            f.name === 'Name'
        );
        
        relevantFields.forEach(field => {
            console.log(`  - ${field.name.padEnd(40)} (${field.type})`);
            if (field.label) console.log(`    Label: ${field.label}`);
        });
        
        // Query records to see the structure
        console.log('\n\n🔍 Querying MA_Contract__c records...\n');
        
        const fieldNames = relevantFields.map(f => f.name).join(', ');
        const query = `
            SELECT Id, ${fieldNames}
            FROM MA_Contract__c
            WHERE MA_ContractLink__c != null
            ORDER BY CreatedDate DESC
            LIMIT 5
        `;
        
        console.log('Query:', query.replace(/\n/g, ' ').replace(/\s+/g, ' '));
        console.log('');
        
        const result = await conn.query(query);
        
        console.log(`✅ Found ${result.records.length} records\n`);
        
        result.records.forEach((record, index) => {
            console.log(`Record ${index + 1}:`);
            console.log(`  Id: ${record.Id}`);
            console.log(`  Name: ${record.Name}`);
            
            // Show all non-null fields
            Object.keys(record).forEach(key => {
                if (key !== 'attributes' && key !== 'Id' && key !== 'Name' && record[key] != null) {
                    const value = record[key];
                    const displayValue = typeof value === 'string' && value.length > 80 
                        ? value.substring(0, 80) + '...' 
                        : value;
                    console.log(`  ${key}: ${displayValue}`);
                }
            });
            
            // Extract RelayState if present
            if (record.MA_ContractLink__c && record.MA_ContractLink__c.includes('RelayState=')) {
                const relayStateValue = record.MA_ContractLink__c.split('RelayState=')[1];
                console.log(`\n  🎯 Extracted RelayState: ${relayStateValue}`);
                console.log(`  🔗 MA SF Link: https://moodysanalytics.my.salesforce.com/${relayStateValue}`);
            }
            
            console.log('');
        });
        
        // Now check if there's a relationship to Prof_Services_Request__c
        console.log('\n🔍 Checking for relationship to Prof_Services_Request__c...\n');
        
        const psDescribe = await conn.sobject('Prof_Services_Request__c').describe();
        const contractFields = psDescribe.fields.filter(f => 
            f.name.toLowerCase().includes('contract') ||
            (f.type === 'reference' && f.referenceTo.includes('MA_Contract__c'))
        );
        
        if (contractFields.length > 0) {
            console.log('✅ Found relationship fields in Prof_Services_Request__c:');
            contractFields.forEach(field => {
                console.log(`  - ${field.name} (${field.type})`);
                if (field.referenceTo) console.log(`    References: ${field.referenceTo.join(', ')}`);
            });
        } else {
            console.log('⚠️  No direct relationship field found');
            console.log('   Will need to join via Account or another field');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

investigateMAContract();

