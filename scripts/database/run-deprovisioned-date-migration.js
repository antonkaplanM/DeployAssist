/**
 * Run migration to remove the deprovisioned_date column from current_accounts
 * (no longer needed - completion_date is reused for the deprovisioning date)
 * Usage: node scripts/database/run-deprovisioned-date-migration.js
 */

require('dotenv').config();
const db = require('../../database');

async function runMigration() {
    console.log('Starting deprovisioned_date cleanup migration...\n');

    try {
        // 1. Check if column exists
        console.log('1. Checking if deprovisioned_date column exists...');
        const columnCheck = await db.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'current_accounts' 
              AND column_name = 'deprovisioned_date'
        `);

        if (columnCheck.rows.length === 0) {
            console.log('   ℹ️  Column does not exist - nothing to do');
            console.log('\n✅ Migration complete (no changes needed)');
            return;
        }

        // 2. Drop the column
        console.log('2. Dropping deprovisioned_date column...');
        await db.query(`ALTER TABLE current_accounts DROP COLUMN IF EXISTS deprovisioned_date`);
        console.log('   ✅ Column dropped');

        // 3. Verify
        console.log('\n3. Verification:');
        const verifyCheck = await db.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'current_accounts' 
              AND column_name = 'deprovisioned_date'
        `);

        if (verifyCheck.rows.length === 0) {
            console.log('   ✅ Confirmed: deprovisioned_date column no longer exists');
            console.log('\n✅ Cleanup migration completed successfully!');
            console.log('   Note: completion_date now serves as the deprovisioning date for Deprovisioned tenants.');
        } else {
            console.log('   ❌ Column still exists - check for errors');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

runMigration();
