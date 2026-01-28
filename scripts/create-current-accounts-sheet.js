/**
 * Create a new "Current Accounts" worksheet in Kevin's Excel file
 * Run with: node scripts/create-current-accounts-sheet.js
 */

require('dotenv').config();

const graphExcelService = require('../services/microsoft-graph-excel.service');
const currentAccountsService = require('../services/current-accounts.service');

async function createSheet() {
    console.log('\n========================================');
    console.log('📊 Creating "Current Accounts" Worksheet');
    console.log('========================================\n');

    try {
        // Step 1: Get the saved file configuration
        const config = graphExcelService.getConfig();
        
        if (!config.driveId || !config.itemId) {
            console.error('❌ No file configured. Please run the access test first.');
            return;
        }

        console.log('📁 Target File:', config.fileName || 'Risk Intelligence Onboarded Tenants.xlsx');
        console.log('   Drive ID:', config.driveId);
        console.log('   Item ID:', config.itemId);

        // Step 2: Fetch current accounts data
        console.log('\n📥 Fetching Current Accounts data...');
        
        const accountsResult = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000,
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: false
        });

        if (!accountsResult.success) {
            console.error('❌ Failed to fetch accounts:', accountsResult.error);
            return;
        }

        const accounts = accountsResult.accounts || [];
        console.log(`✅ Found ${accounts.length} accounts`);

        if (accounts.length === 0) {
            console.error('❌ No accounts to export. Please sync data first.');
            return;
        }

        // Step 3: Create the new worksheet
        console.log('\n📝 Creating "Current Accounts" worksheet...');
        
        const result = await graphExcelService.createWorksheet(
            config.driveId,
            config.itemId,
            'Current Accounts',
            accounts
        );

        if (result.success) {
            console.log('\n========================================');
            console.log('✅ SUCCESS!');
            console.log('========================================');
            console.log('   Worksheet: Current Accounts');
            console.log('   Records Written:', accounts.length);
            console.log('   Message:', result.message);
            console.log('\n💡 You can now open the Excel file and see the new tab!');
        } else {
            console.error('\n❌ Failed to create worksheet:', result.error);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

createSheet();
