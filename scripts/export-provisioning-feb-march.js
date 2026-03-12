/**
 * Export Provisioning Report (Feb–Mar 2026)
 *
 * Creates an Excel file with two tabs:
 *   Tab 1 – "New Tenants"    : Completed requests where TenantRequestAction__c = 'New'
 *   Tab 2 – "Updated Tenants": Completed requests where TenantRequestAction__c = 'Update'
 *
 * Only records with Status__c = 'Tenant Request Completed' (and no SML error) are included.
 *
 * Columns: Account Name, Tenant Name, PS Record #, Date
 *
 * Usage: node scripts/export-provisioning-feb-march.js
 */

require('dotenv').config();

const xlsx = require('xlsx');
const path = require('path');
const salesforce = require('../salesforce');

const START_DATE = '2026-02-01T00:00:00Z';
const END_DATE   = '2026-03-31T23:59:59Z';
const OUTPUT_FILE = path.join(__dirname, '..', 'docs', 'data', 'Provisioning-Feb-Mar-2026.xlsx');

async function fetchByRequestType(requestType) {
    const PAGE_SIZE = 200;
    let offset = 0;
    let allRecords = [];
    let hasMore = true;

    while (hasMore) {
        const result = await salesforce.queryProfServicesRequests({
            requestType,
            startDate: START_DATE,
            endDate: END_DATE,
            pageSize: PAGE_SIZE,
            offset,
        });

        if (!result.success) {
            throw new Error(`Salesforce query failed for "${requestType}": ${result.error}`);
        }

        allRecords = allRecords.concat(result.records);
        hasMore = result.hasMore;
        offset += PAGE_SIZE;
    }

    return allRecords.filter(r =>
        r.Status__c === 'Tenant Request Completed' &&
        !(r.SMLErrorMessage__c && r.SMLErrorMessage__c.trim())
    );
}

function toRows(records) {
    return records.map(r => ({
        'Account Name':  r.Account__c || '',
        'Tenant Name':   r.Tenant_Name__c || r.parsedPayload?.tenantName || '',
        'PS Record #':   r.Name || '',
        'Date':          r.CreatedDate ? new Date(r.CreatedDate).toLocaleDateString('en-US') : '',
    }));
}

async function main() {
    console.log('='.repeat(60));
    console.log('PROVISIONING REPORT — Feb & Mar 2026');
    console.log('='.repeat(60));

    console.log('\nFetching completed "New" provisioning requests…');
    const newRecords = await fetchByRequestType('New');
    console.log(`  Found ${newRecords.length} completed new-tenant records`);

    console.log('Fetching completed "Update" provisioning requests…');
    const updateRecords = await fetchByRequestType('Update');
    console.log(`  Found ${updateRecords.length} completed updated-tenant records`);

    const newRows = toRows(newRecords);
    const updateRows = toRows(updateRecords);

    newRows.sort((a, b) => a['Account Name'].localeCompare(b['Account Name']));
    updateRows.sort((a, b) => a['Account Name'].localeCompare(b['Account Name']));

    const wb = xlsx.utils.book_new();

    const ws1 = xlsx.utils.json_to_sheet(newRows);
    xlsx.utils.book_append_sheet(wb, ws1, 'New Tenants');

    const ws2 = xlsx.utils.json_to_sheet(updateRows);
    xlsx.utils.book_append_sheet(wb, ws2, 'Updated Tenants');

    xlsx.writeFile(wb, OUTPUT_FILE);

    console.log(`\nExcel saved to: ${OUTPUT_FILE}`);
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`  New Tenants tab:     ${newRows.length} records`);
    console.log(`  Updated Tenants tab: ${updateRows.length} records`);
}

main()
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
