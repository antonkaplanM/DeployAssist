require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

const TARGET_ID = '0014000000NXxAnAAL';
const PIMCO_ACCOUNT = 'Pacific Investment Management Company LLC (PIMCO)';

async function bruteForceSearch() {
    try {
        console.log('🔍 BRUTE FORCE SEARCH for:', TARGET_ID);
        console.log('   Searching all accessible Salesforce objects...\n');
        
        const conn = await salesforce.getConnection();
        
        // Get all objects
        const global = await conn.describeGlobal();
        console.log(`📋 Total objects in instance: ${global.sobjects.length}\n`);
        
        // Filter for custom objects and some standard objects
        const objectsToCheck = global.sobjects.filter(obj => {
            // Include all custom objects
            if (obj.name.endsWith('__c')) return true;
            
            // Include specific standard objects that might be accessible
            const standardObjects = ['User', 'Contact', 'Opportunity', 'Case', 'Lead', 'Task', 'Event'];
            if (standardObjects.includes(obj.name)) return true;
            
            return false;
        });
        
        console.log(`📌 Will check ${objectsToCheck.length} objects\n`);
        console.log('═'.repeat(80) + '\n');
        
        const matches = [];
        let checkedCount = 0;
        let accessibleCount = 0;
        
        for (const obj of objectsToCheck) {
            checkedCount++;
            
            try {
                // Get all fields for this object
                const describe = await conn.sobject(obj.name).describe();
                const fields = describe.fields.map(f => f.name);
                
                // Try to query records - limit to recent records for PIMCO-related data
                let query = `SELECT ${fields.join(', ')} FROM ${obj.name}`;
                
                // Add PIMCO filter if object has common name fields
                if (fields.includes('Name')) {
                    query += ` WHERE Name LIKE '%PIMCO%'`;
                } else if (fields.includes('Account__c')) {
                    query += ` WHERE Account__c LIKE '%PIMCO%'`;
                }
                
                query += ` LIMIT 10`;
                
                const result = await conn.query(query);
                accessibleCount++;
                
                console.log(`[${checkedCount}/${objectsToCheck.length}] ✅ ${obj.name.padEnd(45)} - ${result.totalSize} records`);
                
                // Search through all records and fields
                if (result.records && result.records.length > 0) {
                    for (const record of result.records) {
                        for (const [fieldName, fieldValue] of Object.entries(record)) {
                            if (fieldName === 'attributes') continue;
                            
                            // Convert to string and check if it contains our target ID
                            const valueStr = fieldValue ? String(fieldValue) : '';
                            
                            if (valueStr.includes(TARGET_ID)) {
                                const match = {
                                    object: obj.name,
                                    recordId: record.Id,
                                    recordName: record.Name || record.Id,
                                    fieldName: fieldName,
                                    fieldValue: fieldValue
                                };
                                
                                matches.push(match);
                                
                                console.log('\n🎯 MATCH FOUND!');
                                console.log('   Object:', match.object);
                                console.log('   Record:', match.recordName, `(${match.recordId})`);
                                console.log('   Field:', match.fieldName);
                                console.log('   Value:', match.fieldValue);
                                console.log('');
                            }
                        }
                    }
                }
                
            } catch (err) {
                // Silent fail for objects we can't access
                const errorMsg = err.message.split('\n')[0];
                if (!errorMsg.includes('not supported') && !errorMsg.includes('does not exist')) {
                    console.log(`[${checkedCount}/${objectsToCheck.length}] ⚠️  ${obj.name.padEnd(45)} - ${errorMsg.substring(0, 40)}`);
                }
            }
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('\n📊 SEARCH SUMMARY:');
        console.log(`   Objects checked: ${checkedCount}`);
        console.log(`   Objects accessible: ${accessibleCount}`);
        console.log(`   Matches found: ${matches.length}`);
        
        if (matches.length > 0) {
            console.log('\n🎯 ALL MATCHES:\n');
            matches.forEach((match, i) => {
                console.log(`${i + 1}. ${match.object} → ${match.fieldName}`);
                console.log(`   Record: ${match.recordName} (${match.recordId})`);
                console.log(`   Value: ${match.fieldValue}`);
                console.log('');
            });
        } else {
            console.log('\n❌ No matches found for ID:', TARGET_ID);
            console.log('   The ID might be:');
            console.log('   - In the Account object (which we cannot access)');
            console.log('   - Not stored in this Salesforce instance');
            console.log('   - Only available in the MA Salesforce instance');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

bruteForceSearch();

