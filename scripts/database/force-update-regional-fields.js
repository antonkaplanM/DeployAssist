/**
 * Force Update Regional Fields
 * Updates all existing products in database with regional/bundle fields from Salesforce
 * Ignores the LastModifiedDate check to ensure all products get the new fields
 */

require('dotenv').config();
const salesforce = require('./salesforce');
const db = require('./database');

async function forceUpdateRegionalFields() {
    console.log('🔄 Force updating regional fields for existing products...\n');
    
    try {
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');
        
        // Query all products from Salesforce with regional fields
        console.log('📦 Fetching all products with regional fields from Salesforce...');
        const soql = `
            SELECT Id, ProductCode, Continent__c, IRP_Bundle_Region__c, IRP_Bundle_Subregion__c
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
        
        console.log('💾 Updating database with regional fields...');
        
        for (let i = 0; i < allRecords.length; i++) {
            const product = allRecords[i];
            
            try {
                // Check if product exists in database
                const existingProduct = await db.pool.query(
                    'SELECT id FROM products WHERE salesforce_id = $1',
                    [product.Id]
                );
                
                if (existingProduct.rows.length > 0) {
                    // Update the regional fields
                    await db.pool.query(`
                        UPDATE products SET
                            continent = $2,
                            irp_bundle_region = $3,
                            irp_bundle_subregion = $4,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE salesforce_id = $1
                    `, [
                        product.Id,
                        product.Continent__c || null,
                        product.IRP_Bundle_Region__c || null,
                        product.IRP_Bundle_Subregion__c || null
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
                COUNT(continent) as with_continent,
                COUNT(irp_bundle_region) as with_region,
                COUNT(irp_bundle_subregion) as with_subregion
            FROM products
        `);
        
        const s = stats.rows[0];
        console.log('\n📊 Database Statistics:');
        console.log(`   Total products: ${s.total}`);
        console.log(`   With Continent: ${s.with_continent} (${((s.with_continent / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With IRP Region: ${s.with_region} (${((s.with_region / s.total) * 100).toFixed(1)}%)`);
        console.log(`   With IRP Subregion: ${s.with_subregion} (${((s.with_subregion / s.total) * 100).toFixed(1)}%)`);
        
        console.log('\n✅ All products now have the latest regional field data!');
        
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ Force update failed:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

forceUpdateRegionalFields();

