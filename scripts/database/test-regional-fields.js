/**
 * Test Regional Fields Access
 * Verifies that Continent__c, IRP_Bundle_Region__c, and IRP_Bundle_Subregion__c 
 * fields are accessible from Salesforce Product2 object
 */

require('dotenv').config();
const salesforce = require('./salesforce');

async function testRegionalFields() {
    console.log('🧪 Testing regional fields access from Salesforce...\n');
    
    try {
        // Connect to Salesforce
        console.log('🔌 Connecting to Salesforce...');
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');
        
        // Test query with the new fields
        console.log('📦 Testing query with regional and bundle fields...');
        const soql = `
            SELECT Id, Name, ProductCode, 
                   Continent__c, IRP_Bundle_Region__c, IRP_Bundle_Subregion__c
            FROM Product2
            WHERE ProductCode = 'ALM-EQ-ARG'
            LIMIT 1
        `;
        
        const result = await conn.query(soql);
        
        if (result.totalSize === 0) {
            console.log('⚠️  Product with code ALM-EQ-ARG not found');
            console.log('📝 Trying with any product that has these fields...\n');
            
            const anyProductSoql = `
                SELECT Id, Name, ProductCode, 
                       Continent__c, IRP_Bundle_Region__c, IRP_Bundle_Subregion__c
                FROM Product2
                WHERE Continent__c != null 
                OR IRP_Bundle_Region__c != null 
                OR IRP_Bundle_Subregion__c != null
                LIMIT 5
            `;
            
            const anyResult = await conn.query(anyProductSoql);
            
            if (anyResult.totalSize === 0) {
                console.log('⚠️  No products found with regional/bundle fields populated');
            } else {
                console.log(`✅ Found ${anyResult.totalSize} products with regional/bundle fields\n`);
                
                anyResult.records.forEach((product, idx) => {
                    console.log(`${idx + 1}. ${product.Name} (${product.ProductCode || 'No Code'})`);
                    console.log(`   Continent: ${product.Continent__c || 'N/A'}`);
                    console.log(`   IRP Bundle Region: ${product.IRP_Bundle_Region__c || 'N/A'}`);
                    console.log(`   IRP Bundle Subregion: ${product.IRP_Bundle_Subregion__c || 'N/A'}`);
                    console.log('');
                });
            }
        } else {
            console.log(`✅ Successfully retrieved product: ${result.records[0].Name}\n`);
            console.log('📊 Field Values:');
            console.log(`   Product Code: ${result.records[0].ProductCode}`);
            console.log(`   Continent: ${result.records[0].Continent__c || 'N/A'}`);
            console.log(`   IRP Bundle Region: ${result.records[0].IRP_Bundle_Region__c || 'N/A'}`);
            console.log(`   IRP Bundle Subregion: ${result.records[0].IRP_Bundle_Subregion__c || 'N/A'}`);
        }
        
        // Test a broader query to check field accessibility
        console.log('\n🔍 Testing broad query with all new fields...');
        const broadSoql = `
            SELECT Id, Name, ProductCode,
                   Continent__c, IRP_Bundle_Region__c, IRP_Bundle_Subregion__c
            FROM Product2
            WHERE IsDeleted = false
            LIMIT 10
        `;
        
        const broadResult = await conn.query(broadSoql);
        console.log(`✅ Successfully queried ${broadResult.totalSize} products with new fields\n`);
        
        console.log('✅ Regional and bundle fields are accessible from Salesforce!');
        console.log('\n💡 Next steps:');
        console.log('   1. Run: node run-regional-fields-migration.js');
        console.log('   2. Then run: node sync-products-from-salesforce.js');
        console.log('   3. The new fields will be populated in the database\n');
        
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        console.error('Stack:', err.stack);
        
        if (err.message.includes('INVALID_FIELD')) {
            console.error('\n⚠️  ERROR: One or more fields are not accessible.');
            console.error('    This could mean:');
            console.error('    - The field does not exist in your Salesforce org');
            console.error('    - The field name is spelled incorrectly');
            console.error('    - The user does not have permission to access these fields');
        }
        
        process.exit(1);
    }
}

// Run the test
testRegionalFields();

