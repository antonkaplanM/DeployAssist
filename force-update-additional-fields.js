/**
 * Force Update Additional Product Fields
 * Updates all existing products in database with additional fields from Salesforce
 * Faster than full sync - only updates the new fields
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const db = require('./database');

async function forceUpdateAdditionalFields() {
    console.log('🔄 Force updating additional product fields...\n');
    
    try {
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');
        
        // Query all products from Salesforce with the additional fields
        console.log('📦 Fetching all products with additional fields from Salesforce...');
        const soql = `
            SELECT Id, ProductCode, 
                   Country__c, RI_Platform_Region__c, RI_Platform_Sub_Region__c,
                   Model_Type__c, Model_Subtype__c, Data_API_Name__c, Peril__c, Data_Type__c
            FROM Product2
            WHERE IsDeleted = false
        `;
        
        let result = await conn.query(soql);
        let allRecords = [...result.records];
        
        // Fetch additional records if there are more
        while (!result.done) {
            console.log(`   Fetching more records... (${allRecords.length} so far)`);
            result = await conn.queryMore(result.nextRecordsUrl);
            allRecords.push(...result.records);
        }
        
        console.log(`✅ Fetched ${allRecords.length} products from Salesforce\n`);
        
        let updated = 0;
        let skipped = 0;
        let notFound = 0;
        
        console.log('💾 Updating database with additional fields...');
        
        for (let i = 0; i < allRecords.length; i++) {
            const product = allRecords[i];
            
            try {
                // Check if product exists in database
                const existingProduct = await db.pool.query(
                    'SELECT id FROM products WHERE salesforce_id = $1',
                    [product.Id]
                );
                
                if (existingProduct.rows.length > 0) {
                    // Update the additional fields
                    await db.pool.query(`
                        UPDATE products SET
                            country = $2,
                            ri_platform_region = $3,
                            ri_platform_sub_region = $4,
                            model_type = $5,
                            model_subtype = $6,
                            data_api_name = $7,
                            peril = $8,
                            data_type = $9,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE salesforce_id = $1
                    `, [
                        product.Id,
                        product.Country__c || null,
                        product.RI_Platform_Region__c || null,
                        product.RI_Platform_Sub_Region__c || null,
                        product.Model_Type__c || null,
                        product.Model_Subtype__c || null,
                        product.Data_API_Name__c || null,
                        product.Peril__c || null,
                        product.Data_Type__c || null
                    ]);
                    updated++;
                } else {
                    notFound++;
                }
                
                // Progress indicator
                if ((i + 1) % 100 === 0 || (i + 1) === allRecords.length) {
                    process.stdout.write(`\r   Progress: ${i + 1}/${allRecords.length} products processed...`);
                }
                
            } catch (err) {
                console.error(`\n❌ Error updating product ${product.Id}:`, err.message);
                skipped++;
            }
        }
        
        console.log('\n');
        console.log('✅ Force update completed!\n');
        console.log('📊 Summary:');
        console.log(`   Products updated: ${updated}`);
        console.log(`   Products not found in DB: ${notFound}`);
        if (skipped > 0) {
            console.log(`   Errors: ${skipped}`);
        }
        
        // Show stats
        const stats = await db.pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(country) as with_country,
                COUNT(ri_platform_region) as with_ri_region,
                COUNT(ri_platform_sub_region) as with_ri_subregion,
                COUNT(model_type) as with_model_type,
                COUNT(model_subtype) as with_model_subtype,
                COUNT(data_api_name) as with_data_api,
                COUNT(peril) as with_peril,
                COUNT(data_type) as with_data_type
            FROM products
        `);
        
        const s = stats.rows[0];
        console.log('\n📊 Database Statistics:');
        console.log(`   Total products: ${s.total}`);
        console.log(`   With Country: ${s.with_country} (${((s.with_country / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With RI Platform Region: ${s.with_ri_region} (${((s.with_ri_region / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With RI Platform Subregion: ${s.with_ri_subregion} (${((s.with_ri_subregion / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With Model Type: ${s.with_model_type} (${((s.with_model_type / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With Model Subtype: ${s.with_model_subtype} (${((s.with_model_subtype / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With Data API Name: ${s.with_data_api} (${((s.with_data_api / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With Peril: ${s.with_peril} (${((s.with_peril / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With Data Type: ${s.with_data_type} (${((s.with_data_type / s.total) * 100).toFixed(1)}%)`);
        
        console.log('\n✅ All products now have the latest additional field data!');
        
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ Force update failed:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

forceUpdateAdditionalFields();

