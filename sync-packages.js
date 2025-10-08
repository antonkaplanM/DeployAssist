// Sync Packages from Salesforce
// Pulls all packages from Salesforce Package__c and stores them in the database
require('dotenv').config();
const salesforce = require('./salesforce');
const db = require('./database');

async function syncPackagesFromSalesforce() {
    try {
        console.log('🔄 Starting package sync from Salesforce...\n');
        
        // Step 1: Connect to Salesforce
        console.log('🔌 Connecting to Salesforce...');
        const conn = await salesforce.getConnection();
        console.log('✅ Connected to Salesforce\n');
        
        // Step 2: Query all packages from Salesforce
        console.log('📊 Querying Package__c from Salesforce...');
        
        const query = `
            SELECT Id, Name, OwnerId, IsDeleted, CreatedById, LastModifiedById,
                   Locations__c, Max_Concurrent_Model__c, Max_Concurrent_Non_Model__c,
                   Max_Concurrent_Accumulation_Jobs__c, Max_Concurrent_Non_Accumulation_Jobs__c,
                   Max_Jobs_Day__c, Max_Users__c, Number_EDMs__c,
                   Max_Exposure_Storage_TB__c, Max_Other_Storage_TB__c,
                   Max_Risks_Accumulated_Day__c, Max_Risks_Single_Accumulation__c,
                   API_RPS__c, Description__c, Type__c, Parent__c, RI_Package_Name__c
            FROM Package__c
            ORDER BY Name ASC
        `;
        
        const result = await conn.query(query);
        const sfPackages = result.records || [];
        
        console.log(`✅ Found ${sfPackages.length} packages in Salesforce\n`);
        
        if (sfPackages.length === 0) {
            console.log('⚠️  No packages found in Salesforce. Exiting.');
            return {
                success: true,
                synced: 0,
                message: 'No packages found'
            };
        }
        
        // Step 3: Transform and upsert each package to the database
        console.log('💾 Syncing packages to database...\n');
        
        let synced = 0;
        let errors = 0;
        
        for (const sfPackage of sfPackages) {
            try {
                // Transform Salesforce package to database format
                const packageData = {
                    sf_package_id: sfPackage.Id,
                    package_name: sfPackage.Name,
                    ri_package_name: sfPackage.RI_Package_Name__c,
                    package_type: sfPackage.Type__c,
                    parent_package_id: sfPackage.Parent__c,
                    locations: sfPackage.Locations__c,
                    max_concurrent_model: sfPackage.Max_Concurrent_Model__c,
                    max_concurrent_non_model: sfPackage.Max_Concurrent_Non_Model__c,
                    max_concurrent_accumulation_jobs: sfPackage.Max_Concurrent_Accumulation_Jobs__c,
                    max_concurrent_non_accumulation_jobs: sfPackage.Max_Concurrent_Non_Accumulation_Jobs__c,
                    max_jobs_day: sfPackage.Max_Jobs_Day__c,
                    max_users: sfPackage.Max_Users__c,
                    number_edms: sfPackage.Number_EDMs__c,
                    max_exposure_storage_tb: sfPackage.Max_Exposure_Storage_TB__c,
                    max_other_storage_tb: sfPackage.Max_Other_Storage_TB__c,
                    max_risks_accumulated_day: sfPackage.Max_Risks_Accumulated_Day__c,
                    max_risks_single_accumulation: sfPackage.Max_Risks_Single_Accumulation__c,
                    api_rps: sfPackage.API_RPS__c,
                    description: sfPackage.Description__c,
                    sf_owner_id: sfPackage.OwnerId,
                    sf_created_by_id: sfPackage.CreatedById,
                    sf_last_modified_by_id: sfPackage.LastModifiedById,
                    is_deleted: sfPackage.IsDeleted,
                    metadata: {
                        // Store any additional fields here if needed
                        synced_at: new Date().toISOString()
                    }
                };
                
                const result = await db.upsertPackage(packageData);
                
                if (result.success) {
                    synced++;
                    console.log(`  ✓ ${sfPackage.Name} (${sfPackage.RI_Package_Name__c || 'N/A'})`);
                } else {
                    errors++;
                    console.error(`  ✗ ${sfPackage.Name}: ${result.error}`);
                }
                
            } catch (err) {
                errors++;
                console.error(`  ✗ ${sfPackage.Name}: ${err.message}`);
            }
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 SYNC SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  Total packages in Salesforce: ${sfPackages.length}`);
        console.log(`  Successfully synced: ${synced}`);
        console.log(`  Errors: ${errors}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Get summary from database
        const summary = await db.getPackagesSummary();
        
        if (summary.success) {
            console.log('📦 DATABASE SUMMARY:');
            console.log(`  Total packages: ${summary.summary.total_packages}`);
            console.log(`  Active packages: ${summary.summary.active_packages}`);
            console.log(`  Base packages: ${summary.summary.base_packages}`);
            console.log(`  Expansion packages: ${summary.summary.expansion_packages}`);
            console.log(`  Last sync: ${summary.summary.last_sync_time}\n`);
        }
        
        console.log('✅ Package sync complete!\n');
        
        return {
            success: true,
            synced: synced,
            errors: errors,
            total: sfPackages.length
        };
        
    } catch (error) {
        console.error('❌ Error syncing packages:', error.message);
        console.error(error.stack);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Close database connection
        await db.closePool();
    }
}

// Run the sync
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                     SALESFORCE PACKAGE SYNC                               ');
console.log('═══════════════════════════════════════════════════════════════════════════\n');

syncPackagesFromSalesforce();

