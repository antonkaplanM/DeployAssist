#!/usr/bin/env node
/**
 * Update Account Types Script
 * 
 * This script updates the account_type field for all current_accounts records
 * based on the new calculation methodology:
 * - Find the LONGEST entitlement across ALL products (Apps, Models, Data) for each tenant
 * - POC if longest term < 90 days
 * - Subscription if longest term >= 90 days
 * 
 * Usage: node scripts/update-account-types.js
 */

// Load environment variables
require('dotenv').config();

const db = require('../database');

const POC_THRESHOLD_DAYS = 90;

/**
 * Calculate account type based on the longest entitlement across all products
 */
function calculateAccountType(productEntitlements) {
    let entitlements = null;
    
    if (productEntitlements) {
        entitlements = typeof productEntitlements === 'string'
            ? JSON.parse(productEntitlements)
            : productEntitlements;
    }

    if (!entitlements) {
        return 'Unknown';
    }

    // Collect ALL products from all categories
    const allProducts = [
        ...(entitlements.appEntitlements || []),
        ...(entitlements.modelEntitlements || []),
        ...(entitlements.dataEntitlements || [])
    ];

    if (allProducts.length === 0) {
        return 'Unknown';
    }

    // Find the longest term across all products
    let longestTermDays = 0;
    let longestProduct = null;

    for (const product of allProducts) {
        const startDate = product.startDate ? new Date(product.startDate) : null;
        const endDate = product.endDate ? new Date(product.endDate) : null;

        if (startDate && endDate) {
            const termInDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
            if (termInDays > longestTermDays) {
                longestTermDays = termInDays;
                longestProduct = {
                    productCode: product.productCode,
                    startDate: product.startDate,
                    endDate: product.endDate,
                    termDays: Math.round(termInDays)
                };
            }
        }
    }

    // POC if longest term < 90 days, Subscription if >= 90 days
    if (longestTermDays === 0) {
        return { type: 'Unknown', longestProduct: null, longestTermDays: 0 };
    }

    const type = longestTermDays >= POC_THRESHOLD_DAYS ? 'Subscription' : 'POC';
    return { type, longestProduct, longestTermDays: Math.round(longestTermDays) };
}

async function updateAccountTypes() {
    console.log('=========================================');
    console.log('  Update Account Types Script');
    console.log('=========================================');
    console.log(`Threshold: ${POC_THRESHOLD_DAYS} days (< ${POC_THRESHOLD_DAYS} = POC, >= ${POC_THRESHOLD_DAYS} = Subscription)`);
    console.log('');

    try {
        // Step 1: Get all unique tenants from sml_tenant_data with their entitlements
        console.log('📊 Step 1: Fetching tenant entitlement data from sml_tenant_data...');
        const tenantsResult = await db.query(`
            SELECT tenant_name, product_entitlements
            FROM sml_tenant_data
            WHERE tenant_name IS NOT NULL
        `);
        
        const tenants = tenantsResult.rows;
        console.log(`   Found ${tenants.length} tenants with entitlement data`);

        // Step 2: Calculate the correct account type for each tenant
        console.log('');
        console.log('🔄 Step 2: Calculating account types based on longest entitlement...');
        
        const tenantTypes = new Map();
        let pocCount = 0;
        let subscriptionCount = 0;
        let unknownCount = 0;

        for (const tenant of tenants) {
            const result = calculateAccountType(tenant.product_entitlements);
            tenantTypes.set(tenant.tenant_name, result);
            
            if (result.type === 'POC') pocCount++;
            else if (result.type === 'Subscription') subscriptionCount++;
            else unknownCount++;
        }

        console.log(`   Calculated types: ${subscriptionCount} Subscription, ${pocCount} POC, ${unknownCount} Unknown`);

        // Step 3: Get current account types in the database for comparison
        console.log('');
        console.log('📋 Step 3: Checking current account types in database...');
        
        const currentTypesResult = await db.query(`
            SELECT tenant_name, account_type, COUNT(*) as record_count
            FROM current_accounts
            WHERE tenant_name IS NOT NULL
            GROUP BY tenant_name, account_type
        `);

        const changesNeeded = [];
        
        for (const row of currentTypesResult.rows) {
            const tenantData = tenantTypes.get(row.tenant_name);
            if (tenantData && tenantData.type !== row.account_type) {
                changesNeeded.push({
                    tenant_name: row.tenant_name,
                    old_type: row.account_type,
                    new_type: tenantData.type,
                    record_count: parseInt(row.record_count),
                    longest_product: tenantData.longestProduct,
                    longest_term_days: tenantData.longestTermDays
                });
            }
        }

        console.log(`   Found ${changesNeeded.length} tenants that need account type updates`);

        if (changesNeeded.length === 0) {
            console.log('');
            console.log('✅ No updates needed - all account types are already correct!');
            return;
        }

        // Step 4: Show preview of changes
        console.log('');
        console.log('📝 Step 4: Preview of changes:');
        console.log('─'.repeat(100));
        console.log('Tenant Name'.padEnd(30) + 'Old Type'.padEnd(15) + 'New Type'.padEnd(15) + 'Records'.padEnd(10) + 'Longest Product (Days)');
        console.log('─'.repeat(100));
        
        let totalRecordsToUpdate = 0;
        for (const change of changesNeeded.slice(0, 20)) { // Show first 20
            const longestInfo = change.longest_product 
                ? `${change.longest_product.productCode} (${change.longest_term_days}d)`
                : 'N/A';
            const oldType = change.old_type || 'Unknown';
            const newType = change.new_type || 'Unknown';
            const tenantName = change.tenant_name || 'Unknown';
            console.log(
                tenantName.substring(0, 29).padEnd(30) +
                oldType.padEnd(15) +
                newType.padEnd(15) +
                String(change.record_count).padEnd(10) +
                longestInfo
            );
            totalRecordsToUpdate += change.record_count;
        }
        
        if (changesNeeded.length > 20) {
            console.log(`... and ${changesNeeded.length - 20} more tenants`);
        }
        console.log('─'.repeat(100));
        console.log(`Total: ${changesNeeded.length} tenants, ${totalRecordsToUpdate} records to update`);

        // Step 5: Apply updates
        console.log('');
        console.log('🚀 Step 5: Applying updates...');
        
        let updatedCount = 0;
        let errorCount = 0;

        for (const change of changesNeeded) {
            try {
                const result = await db.query(`
                    UPDATE current_accounts
                    SET account_type = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE tenant_name = $2
                `, [change.new_type, change.tenant_name]);
                
                updatedCount += result.rowCount;
            } catch (error) {
                console.error(`   ❌ Error updating ${change.tenant_name}: ${error.message}`);
                errorCount++;
            }
        }

        console.log('');
        console.log('=========================================');
        console.log('  Summary');
        console.log('=========================================');
        console.log(`✅ Updated ${updatedCount} records across ${changesNeeded.length - errorCount} tenants`);
        if (errorCount > 0) {
            console.log(`❌ ${errorCount} tenants failed to update`);
        }
        console.log('');
        console.log('Account types have been recalculated based on the longest entitlement.');
        console.log('');

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        // Close the database pool if the method exists
        if (db.pool && typeof db.pool.end === 'function') {
            await db.pool.end();
        }
    }
}

// Run the script
updateAccountTypes().then(() => {
    console.log('Script completed.');
    process.exit(0);
}).catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
