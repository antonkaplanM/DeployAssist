/**
 * Test Excel Lookup File Access
 * 
 * This script tests if the Excel file for the Excel Lookup feature
 * is accessible via Microsoft Graph API.
 * 
 * Usage: node scripts/test-excel-lookup-file.js [shareUrl]
 * 
 * If no URL is provided, it will try to resolve the default test file URL.
 */

require('dotenv').config();

const graphExcelService = require('../services/microsoft-graph-excel.service');
const microsoftAuthService = require('../services/microsoft-auth.service');

const DEFAULT_TEST_URL = 'https://moodys-my.sharepoint.com/:x:/p/kaplana/IQAVVyHRFO-yQ7RjNU6rHI_aAY_5tiIUFuM0541-SQ0-ZSw';

async function testExcelFileAccess(shareUrl) {
    console.log('🔍 Testing Excel Lookup File Access');
    console.log('=' .repeat(50));
    
    // Step 1: Check Microsoft Graph authentication
    console.log('\n📋 Step 1: Checking Microsoft Graph authentication...');
    
    if (!microsoftAuthService.isConfigured()) {
        console.error('❌ Microsoft Graph API not configured!');
        console.error('   Please set AZURE_CLIENT_ID, AZURE_TENANT_ID, and AZURE_CLIENT_SECRET in .env');
        return;
    }
    
    const connectionStatus = await microsoftAuthService.getConnectionStatus();
    if (!connectionStatus.connected) {
        console.error('❌ Not connected to Microsoft Graph!');
        console.error('   Please authenticate via the web app: http://localhost:5000');
        console.error('   Go to Current Accounts > Update Excel > Connect to OneDrive');
        return;
    }
    
    console.log('✅ Connected to Microsoft Graph as:', connectionStatus.user?.displayName || 'Unknown');
    
    // Step 2: Test access to the shared file
    console.log('\n📋 Step 2: Testing access to shared file...');
    console.log('   URL:', shareUrl);
    
    try {
        const result = await graphExcelService.testSharedFileAccess(shareUrl);
        
        if (result.success) {
            console.log('\n✅ FILE ACCESS SUCCESSFUL!');
            console.log('=' .repeat(50));
            console.log('📁 File Name:', result.file?.name);
            console.log('📊 Worksheets:', result.worksheets?.map(ws => ws.name).join(', ') || 'None');
            console.log('🔑 Drive ID:', result.file?.driveId);
            console.log('🔑 Item ID:', result.file?.id);
            console.log('📖 Can Read:', result.canRead ? 'Yes' : 'No');
            console.log('✏️  Can Write:', result.canWrite ? 'Yes' : 'No');
            
            console.log('\n📋 Steps completed:');
            result.steps.forEach((step, i) => {
                const icon = step.status === 'success' ? '✅' : step.status === 'warning' ? '⚠️' : '❌';
                console.log(`   ${i + 1}. ${icon} ${step.step}`);
            });
            
            console.log('\n🎉 This file is ready for use with the Excel Lookup feature!');
            
            // Save the file info for future use
            console.log('\n💾 Saving file configuration...');
            graphExcelService.saveConfig({
                driveId: result.file?.driveId,
                itemId: result.file?.id,
                fileName: result.file?.name,
                worksheetName: result.worksheets?.[0]?.name || 'Sheet1'
            });
            console.log('✅ Configuration saved to config/onedrive-excel-config.json');
            
        } else {
            console.error('\n❌ FILE ACCESS FAILED!');
            console.error('   Error:', result.error);
            
            if (result.steps) {
                console.log('\n📋 Steps attempted:');
                result.steps.forEach((step, i) => {
                    const icon = step.status === 'success' ? '✅' : step.status === 'warning' ? '⚠️' : '❌';
                    console.log(`   ${i + 1}. ${icon} ${step.step}`);
                    if (step.error) console.log(`      Error: ${step.error}`);
                });
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error testing file access:', error.message);
    }
}

// Run the test
const shareUrl = process.argv[2] || DEFAULT_TEST_URL;
testExcelFileAccess(shareUrl)
    .then(() => {
        console.log('\n🏁 Test complete.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
