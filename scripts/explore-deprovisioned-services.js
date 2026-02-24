/**
 * Exploration script to check what service data is available for deprovisioned tenants
 */

require('dotenv').config();
const db = require('../database');

async function explore() {
    console.log('🔍 Deep dive into deprovisioned tenant service data...\n');

    // 1. Check sml_tenant_data for "gogus" - it has entitlements!
    console.log('='.repeat(60));
    console.log('1. SML tenant data for gogus (deprovisioned):');
    console.log('='.repeat(60));
    const gogusResult = await db.query(`
        SELECT tenant_name, product_entitlements
        FROM sml_tenant_data
        WHERE tenant_name = 'gogus'
    `);
    if (gogusResult.rows.length > 0) {
        const row = gogusResult.rows[0];
        console.log(`Tenant: ${row.tenant_name}`);
        if (row.product_entitlements) {
            const ents = typeof row.product_entitlements === 'string' 
                ? JSON.parse(row.product_entitlements) 
                : row.product_entitlements;
            console.log('Entitlement structure:');
            console.log(JSON.stringify(ents, null, 2));
        }
    }

    // 2. Check a "New" request payload for an active tenant - see what product info is in there
    console.log('\n' + '='.repeat(60));
    console.log('2. Sample "New" request payload (to see product structure):');
    console.log('='.repeat(60));
    const newRequestResult = await db.query(`
        SELECT tenant_name, payload_data, account_name
        FROM ps_audit_trail
        WHERE request_type = 'New'
        AND payload_data IS NOT NULL
        AND payload_data != ''
        LIMIT 1
    `);
    if (newRequestResult.rows.length > 0) {
        const row = newRequestResult.rows[0];
        console.log(`Tenant: ${row.tenant_name}`);
        console.log(`Account: ${row.account_name}`);
        try {
            const payload = JSON.parse(row.payload_data);
            console.log('Full payload structure:');
            console.log(JSON.stringify(payload, null, 2).substring(0, 2000));
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }

    // 3. Check "Update" request payloads - might contain product updates
    console.log('\n' + '='.repeat(60));
    console.log('3. Sample "Update" request payload with provisioningDetail:');
    console.log('='.repeat(60));
    const updateRequestResult = await db.query(`
        SELECT tenant_name, payload_data, account_name
        FROM ps_audit_trail
        WHERE request_type = 'Update'
        AND payload_data IS NOT NULL
        AND payload_data LIKE '%provisioningDetail%'
        LIMIT 1
    `);
    if (updateRequestResult.rows.length > 0) {
        const row = updateRequestResult.rows[0];
        console.log(`Tenant: ${row.tenant_name}`);
        try {
            const payload = JSON.parse(row.payload_data);
            if (payload.properties?.provisioningDetail) {
                console.log('provisioningDetail:');
                console.log(JSON.stringify(payload.properties.provisioningDetail, null, 2).substring(0, 2000));
            }
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }

    // 4. Look for historical "Update" records for a specific deprovisioned tenant
    console.log('\n' + '='.repeat(60));
    console.log('4. Historical records for deprovisioned tenant "gogus":');
    console.log('='.repeat(60));
    const gogusHistoryResult = await db.query(`
        SELECT ps_record_name, request_type, status, created_date, payload_data
        FROM ps_audit_trail
        WHERE tenant_name = 'gogus'
        ORDER BY created_date ASC
    `);
    console.log(`Found ${gogusHistoryResult.rows.length} history records`);
    for (const row of gogusHistoryResult.rows) {
        console.log(`\n  ${row.ps_record_name} - ${row.request_type} - ${row.status}`);
        console.log(`    Created: ${row.created_date}`);
        if (row.payload_data) {
            try {
                const payload = JSON.parse(row.payload_data);
                const detail = payload.properties?.provisioningDetail;
                if (detail) {
                    console.log(`    Products in provisioningDetail: ${JSON.stringify(detail.products || detail.apps || 'none').substring(0, 200)}`);
                }
            } catch (e) {}
        }
    }

    // 5. See what's in the sml_tenant_data - structure
    console.log('\n' + '='.repeat(60));
    console.log('5. Sample sml_tenant_data with entitlements (for active tenant):');
    console.log('='.repeat(60));
    const smlSampleResult = await db.query(`
        SELECT tenant_name, product_entitlements
        FROM sml_tenant_data
        WHERE product_entitlements IS NOT NULL
        LIMIT 1
    `);
    if (smlSampleResult.rows.length > 0) {
        const row = smlSampleResult.rows[0];
        console.log(`Tenant: ${row.tenant_name}`);
        const ents = typeof row.product_entitlements === 'string' 
            ? JSON.parse(row.product_entitlements) 
            : row.product_entitlements;
        console.log('App Entitlements count:', (ents.appEntitlements || []).length);
        console.log('Model Entitlements count:', (ents.modelEntitlements || []).length);
        console.log('Data Entitlements count:', (ents.dataEntitlements || []).length);
        if (ents.appEntitlements && ents.appEntitlements.length > 0) {
            console.log('\nSample app entitlement:');
            console.log(JSON.stringify(ents.appEntitlements[0], null, 2));
        }
    }

    // 6. Check distinct tenants in sml_tenant_data vs current_accounts
    console.log('\n' + '='.repeat(60));
    console.log('6. Deprovisioned tenants that have SML data:');
    console.log('='.repeat(60));
    const deproWithSmlResult = await db.query(`
        SELECT ca.tenant_name, ca.client, 
               CASE WHEN std.tenant_name IS NOT NULL THEN 'Yes' ELSE 'No' END as has_sml_data,
               CASE WHEN std.product_entitlements IS NOT NULL THEN 'Yes' ELSE 'No' END as has_entitlements
        FROM current_accounts ca
        LEFT JOIN sml_tenant_data std ON ca.tenant_name = std.tenant_name
        WHERE ca.tenant_status = 'Deprovisioned'
        AND std.tenant_name IS NOT NULL
    `);
    console.log(`Found ${deproWithSmlResult.rows.length} deprovisioned tenants WITH sml_tenant_data`);
    for (const row of deproWithSmlResult.rows) {
        console.log(`  - ${row.tenant_name}: has_sml=${row.has_sml_data}, has_entitlements=${row.has_entitlements}`);
    }

    console.log('\n✅ Done exploring!');
    process.exit(0);
}

explore().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
