/**
 * Sync Products from Salesforce
 * Pulls all products from Salesforce Product2 object and stores in local database
 */

const salesforce = require('./salesforce');
const db = require('./database');

async function syncProducts() {
    console.log('🚀 Starting product sync from Salesforce...\n');
    
    const syncStartTime = new Date();
    let syncLogId;
    
    try {
        // Create sync log entry
        const logResult = await db.pool.query(`
            INSERT INTO product_sync_log (sync_started_at, status)
            VALUES ($1, 'in_progress')
            RETURNING id
        `, [syncStartTime]);
        syncLogId = logResult.rows[0].id;
        console.log(`📝 Sync log ID: ${syncLogId}\n`);
        
        // Connect to Salesforce
        console.log('🔌 Connecting to Salesforce...');
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');
        
        // Query all products from Salesforce
        console.log('📦 Fetching products from Salesforce Product2...');
        const soql = `
            SELECT Id, Name, ProductCode, Description, Family, IsActive, IsArchived, DisplayUrl,
                   Product_Group__c, Product_Family_L2__c, ProductReportingGroup__c,
                   Product_Variant__c, ProductVersions__c, TypeOfConfiguration__c,
                   IsExpansionPack__c, Product_Selection_Grouping__c, Product_Selection_Restriction__c,
                   CreatedDate, LastModifiedDate, CreatedById, LastModifiedById
            FROM Product2
            WHERE IsDeleted = false
            ORDER BY Name ASC
        `;
        
        const result = await conn.query(soql);
        console.log(`✅ Found ${result.totalSize} products in Salesforce\n`);
        
        let productsAdded = 0;
        let productsUpdated = 0;
        let productsUnchanged = 0;
        let errors = 0;
        
        console.log('💾 Syncing products to database...');
        
        // Process products in batches
        for (let i = 0; i < result.records.length; i++) {
            const product = result.records[i];
            
            try {
                // Check if product already exists
                const existingProduct = await db.pool.query(
                    'SELECT id, sf_last_modified_date FROM products WHERE salesforce_id = $1',
                    [product.Id]
                );
                
                const productData = {
                    salesforce_id: product.Id,
                    name: product.Name,
                    product_code: product.ProductCode || null,
                    description: product.Description || null,
                    family: product.Family || null,
                    is_active: product.IsActive || false,
                    is_archived: product.IsArchived || false,
                    display_url: product.DisplayUrl || null,
                    product_group: product.Product_Group__c || null,
                    product_family_l2: product.Product_Family_L2__c || null,
                    product_reporting_group: product.ProductReportingGroup__c || null,
                    product_variant: product.Product_Variant__c || null,
                    product_versions: product.ProductVersions__c || null,
                    type_of_configuration: product.TypeOfConfiguration__c || null,
                    is_expansion_pack: product.IsExpansionPack__c || false,
                    product_selection_grouping: product.Product_Selection_Grouping__c || null,
                    product_selection_restriction: product.Product_Selection_Restriction__c || null,
                    sf_created_date: product.CreatedDate || null,
                    sf_last_modified_date: product.LastModifiedDate || null,
                    sf_created_by_id: product.CreatedById || null,
                    sf_last_modified_by_id: product.LastModifiedById || null,
                    synced_at: new Date()
                };
                
                if (existingProduct.rows.length === 0) {
                    // Insert new product
                    await db.pool.query(`
                        INSERT INTO products (
                            salesforce_id, name, product_code, description, family,
                            is_active, is_archived, display_url,
                            product_group, product_family_l2, product_reporting_group,
                            product_variant, product_versions, type_of_configuration,
                            is_expansion_pack, product_selection_grouping, product_selection_restriction,
                            sf_created_date, sf_last_modified_date, sf_created_by_id, sf_last_modified_by_id,
                            synced_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                        )
                    `, [
                        productData.salesforce_id, productData.name, productData.product_code,
                        productData.description, productData.family, productData.is_active,
                        productData.is_archived, productData.display_url, productData.product_group,
                        productData.product_family_l2, productData.product_reporting_group,
                        productData.product_variant, productData.product_versions,
                        productData.type_of_configuration, productData.is_expansion_pack,
                        productData.product_selection_grouping, productData.product_selection_restriction,
                        productData.sf_created_date, productData.sf_last_modified_date,
                        productData.sf_created_by_id, productData.sf_last_modified_by_id,
                        productData.synced_at
                    ]);
                    productsAdded++;
                } else {
                    // Update existing product if modified
                    const lastModified = new Date(product.LastModifiedDate);
                    const existingModified = new Date(existingProduct.rows[0].sf_last_modified_date);
                    
                    if (lastModified > existingModified) {
                        await db.pool.query(`
                            UPDATE products SET
                                name = $2, product_code = $3, description = $4, family = $5,
                                is_active = $6, is_archived = $7, display_url = $8,
                                product_group = $9, product_family_l2 = $10, product_reporting_group = $11,
                                product_variant = $12, product_versions = $13, type_of_configuration = $14,
                                is_expansion_pack = $15, product_selection_grouping = $16,
                                product_selection_restriction = $17,
                                sf_created_date = $18, sf_last_modified_date = $19,
                                sf_created_by_id = $20, sf_last_modified_by_id = $21,
                                synced_at = $22, updated_at = $22
                            WHERE salesforce_id = $1
                        `, [
                            productData.salesforce_id, productData.name, productData.product_code,
                            productData.description, productData.family, productData.is_active,
                            productData.is_archived, productData.display_url, productData.product_group,
                            productData.product_family_l2, productData.product_reporting_group,
                            productData.product_variant, productData.product_versions,
                            productData.type_of_configuration, productData.is_expansion_pack,
                            productData.product_selection_grouping, productData.product_selection_restriction,
                            productData.sf_created_date, productData.sf_last_modified_date,
                            productData.sf_created_by_id, productData.sf_last_modified_by_id,
                            productData.synced_at
                        ]);
                        productsUpdated++;
                    } else {
                        productsUnchanged++;
                    }
                }
                
                // Progress indicator
                if ((i + 1) % 50 === 0 || (i + 1) === result.records.length) {
                    process.stdout.write(`\r   Progress: ${i + 1}/${result.records.length} products processed...`);
                }
                
            } catch (err) {
                console.error(`\n❌ Error processing product ${product.Id} (${product.Name}):`, err.message);
                errors++;
            }
        }
        
        console.log('\n');
        
        // Update sync log
        const syncEndTime = new Date();
        await db.pool.query(`
            UPDATE product_sync_log SET
                sync_completed_at = $1,
                total_products = $2,
                products_added = $3,
                products_updated = $4,
                products_unchanged = $5,
                status = 'completed'
            WHERE id = $6
        `, [syncEndTime, result.totalSize, productsAdded, productsUpdated, productsUnchanged, syncLogId]);
        
        // Get product family stats
        const familyStats = await db.pool.query(`
            SELECT family, COUNT(*) as count
            FROM products
            WHERE is_active = true AND family IS NOT NULL
            GROUP BY family
            ORDER BY count DESC
            LIMIT 10
        `);
        
        console.log('✅ Product sync completed successfully!\n');
        console.log('📊 Sync Summary:');
        console.log(`   Total products in Salesforce: ${result.totalSize}`);
        console.log(`   Products added: ${productsAdded}`);
        console.log(`   Products updated: ${productsUpdated}`);
        console.log(`   Products unchanged: ${productsUnchanged}`);
        if (errors > 0) {
            console.log(`   Errors: ${errors}`);
        }
        console.log(`   Duration: ${((syncEndTime - syncStartTime) / 1000).toFixed(2)} seconds`);
        
        console.log('\n📊 Top Product Families:');
        familyStats.rows.forEach((row, idx) => {
            console.log(`   ${idx + 1}. ${row.family}: ${row.count} products`);
        });
        
        console.log('\n✅ Products are now available in the local database!');
        console.log('🔗 Access via: /api/product-catalogue');
        
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ Sync failed:', err.message);
        console.error('Stack:', err.stack);
        
        // Update sync log with error
        if (syncLogId) {
            await db.pool.query(`
                UPDATE product_sync_log SET
                    sync_completed_at = $1,
                    status = 'failed',
                    error_message = $2
                WHERE id = $3
            `, [new Date(), err.message, syncLogId]);
        }
        
        process.exit(1);
    }
}

// Run the sync
syncProducts();

