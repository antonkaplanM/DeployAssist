/**
 * Test script to verify access to a shared OneDrive file
 * Run with: node scripts/test-shared-file-access.js
 */

require('dotenv').config();

const graphExcelService = require('../services/microsoft-graph-excel.service');

const shareUrl = process.argv[2] || 'https://moodys-my.sharepoint.com/:x:/r/personal/yuk4_moodys_com/Documents/Documents/RMS/Risk%20Intelligence%20Tenants/Risk%20Intelligence%20Onboarded%20Tenants.xlsx?d=wdb87db08a67742d9bc70bb53509add72&csf=1&web=1&e=ly2QA2';

async function testAccess() {
    console.log('\n========================================');
    console.log('🔍 Testing Shared File Access');
    console.log('========================================\n');
    console.log('📁 File URL:', shareUrl);
    console.log('\n----------------------------------------\n');

    try {
        const result = await graphExcelService.testSharedFileAccess(shareUrl);
        
        console.log('\n========================================');
        console.log('📊 TEST RESULTS');
        console.log('========================================\n');
        
        if (result.success) {
            console.log('✅ SUCCESS! You can access this file.\n');
            console.log('📄 File Details:');
            console.log('   Name:', result.file?.name);
            console.log('   Last Modified:', result.file?.lastModified);
            console.log('   Modified By:', result.file?.lastModifiedBy);
            console.log('   Drive ID:', result.file?.driveId);
            console.log('   Item ID:', result.file?.id);
            
            console.log('\n📋 Worksheets Found:');
            result.worksheets?.forEach((ws, i) => {
                console.log(`   ${i + 1}. ${ws.name}`);
            });
            
            console.log('\n🔐 Permissions:');
            console.log('   Can Read:', result.canRead ? '✅ Yes' : '❌ No');
            console.log('   Can Write:', result.canWrite ? '✅ Yes (likely)' : '⚠️ Uncertain');
            
            console.log('\n💡 Recommendation:');
            console.log('  ', result.summary?.recommendation);
            
            // Save config for future use
            if (result.file?.driveId && result.file?.id) {
                console.log('\n📝 Saving file configuration for future updates...');
                graphExcelService.saveConfig({
                    driveId: result.file.driveId,
                    itemId: result.file.id,
                    fileName: result.file.name
                });
                console.log('   Configuration saved!');
            }
        } else {
            console.log('❌ FAILED to access the file.\n');
            console.log('Error:', result.error);
            
            if (result.steps?.length) {
                console.log('\n📋 Steps attempted:');
                result.steps.forEach((step, i) => {
                    const icon = step.status === 'success' ? '✅' : step.status === 'warning' ? '⚠️' : '❌';
                    console.log(`   ${i + 1}. ${icon} ${step.step}`);
                    if (step.error) {
                        console.log(`      Error: ${step.error}`);
                    }
                });
            }
        }
        
        console.log('\n========================================\n');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error(error.stack);
    }
}

testAccess();
