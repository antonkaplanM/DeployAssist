/**
 * Fix Duplicate Records in Current Accounts Table
 * 
 * This script:
 * 1. Identifies duplicate records (same tenant_name + services)
 * 2. Keeps only the most recent record (by updated_at or id)
 * 3. Removes duplicates
 * 4. Updates the unique constraint to (tenant_name, services)
 * 5. Updates the upsert key in the service to match
 * 
 * Usage: node scripts/fix-duplicate-records.js
 */

require('dotenv').config();
const db = require('../database');

async function fixDuplicates() {
    console.log('='.repeat(60));
    console.log('🔧 Fixing Duplicate Records in current_accounts');
    console.log('='.repeat(60));

    try {
        // Step 1: Find all duplicates (same tenant_name + services) - check ALL records
        console.log('\n📊 Step 1: Finding duplicates (all statuses)...');
        const duplicatesQuery = await db.query(`
            SELECT tenant_name, services, COUNT(*) as count
            FROM current_accounts
            GROUP BY tenant_name, services
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);

        console.log(`   Found ${duplicatesQuery.rows.length} duplicate groups`);
        
        if (duplicatesQuery.rows.length === 0) {
            console.log('   ✅ No duplicates found!');
            process.exit(0);
        }

        // Show top duplicates
        console.log('\n   Top duplicates:');
        duplicatesQuery.rows.slice(0, 10).forEach(row => {
            console.log(`   - ${row.tenant_name} + ${row.services}: ${row.count} records`);
        });

        // Step 2: For each duplicate group, keep only the record with the latest PS record
        console.log('\n🗑️  Step 2: Removing duplicates (keeping most recent)...');
        
        let totalDeleted = 0;
        
        for (const dup of duplicatesQuery.rows) {
            // Get all records for this tenant+service, ordered by completion_date DESC, then id DESC
            const records = await db.query(`
                SELECT id, tenant_name, services, ps_record_name, completion_date, updated_at
                FROM current_accounts
                WHERE tenant_name = $1 AND services = $2
                ORDER BY completion_date DESC NULLS LAST, updated_at DESC, id DESC
            `, [dup.tenant_name, dup.services]);

            // Keep the first one (most recent), delete the rest
            const idsToKeep = records.rows[0].id;
            const idsToDelete = records.rows.slice(1).map(r => r.id);

            if (idsToDelete.length > 0) {
                const deleteResult = await db.query(`
                    DELETE FROM current_accounts
                    WHERE id = ANY($1)
                    RETURNING id
                `, [idsToDelete]);
                
                totalDeleted += deleteResult.rowCount;
            }
        }

        console.log(`   ✅ Deleted ${totalDeleted} duplicate records`);

        // Step 3: Change the unique constraint
        console.log('\n🔑 Step 3: Updating unique constraint...');
        
        // Drop old constraint
        try {
            await db.query(`
                ALTER TABLE current_accounts
                DROP CONSTRAINT IF EXISTS current_accounts_client_services_tenant_id_ps_record_id_key
            `);
            console.log('   Dropped old constraint (client, services, tenant_id, ps_record_id)');
        } catch (e) {
            console.log('   Old constraint not found (may have different name)');
        }

        // Add new constraint on (tenant_name, services)
        try {
            await db.query(`
                ALTER TABLE current_accounts
                ADD CONSTRAINT current_accounts_tenant_services_unique
                UNIQUE (tenant_name, services)
            `);
            console.log('   ✅ Added new constraint (tenant_name, services)');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('   New constraint already exists');
            } else {
                throw e;
            }
        }

        // Step 4: Verify
        console.log('\n✅ Step 4: Verification...');
        const verifyQuery = await db.query(`
            SELECT tenant_name, services, COUNT(*) as count
            FROM current_accounts
            GROUP BY tenant_name, services
            HAVING COUNT(*) > 1
        `);

        if (verifyQuery.rows.length === 0) {
            console.log('   ✅ No more duplicates!');
        } else {
            console.log(`   ⚠️ Still have ${verifyQuery.rows.length} duplicate groups`);
        }

        // Final stats
        const statsQuery = await db.query(`
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT tenant_name) as unique_tenants,
                COUNT(*) FILTER (WHERE record_status = 'active') as active_records
            FROM current_accounts
        `);

        console.log('\n' + '='.repeat(60));
        console.log('📊 Final Statistics:');
        console.log('='.repeat(60));
        console.log(`   Total records: ${statsQuery.rows[0].total_records}`);
        console.log(`   Unique tenants: ${statsQuery.rows[0].unique_tenants}`);
        console.log(`   Active records: ${statsQuery.rows[0].active_records}`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

fixDuplicates();

