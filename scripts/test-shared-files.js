/**
 * Test script to debug shared files listing
 * Run with: node scripts/test-shared-files.js
 */

require('dotenv').config();

const graphExcelService = require('../services/microsoft-graph-excel.service');

async function testSharedFiles() {
    console.log('\n========================================');
    console.log('🔍 Testing Shared Files Listing');
    console.log('========================================\n');

    try {
        // Test personal files first
        console.log('📁 Testing Personal Files...');
        const personalResult = await graphExcelService.listAllPersonalExcelFiles();
        console.log(`   Result: ${personalResult.success ? 'Success' : 'Failed'}`);
        console.log(`   Files found: ${personalResult.files?.length || 0}`);
        if (personalResult.files?.length > 0) {
            personalResult.files.slice(0, 3).forEach(f => {
                console.log(`   - ${f.name}`);
            });
        }

        console.log('\n----------------------------------------\n');

        // Test shared files
        console.log('📁 Testing Shared Files...');
        const sharedResult = await graphExcelService.listAllSharedExcelFiles();
        console.log(`   Result: ${sharedResult.success ? 'Success' : 'Failed'}`);
        if (sharedResult.error) {
            console.log(`   Error: ${sharedResult.error}`);
        }
        console.log(`   Files found: ${sharedResult.files?.length || 0}`);
        if (sharedResult.files?.length > 0) {
            sharedResult.files.forEach(f => {
                console.log(`   - ${f.name} (shared by: ${f.sharedBy})`);
            });
        }

        console.log('\n========================================\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

testSharedFiles();
