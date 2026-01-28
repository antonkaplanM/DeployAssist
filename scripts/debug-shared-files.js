/**
 * Debug script to check what the sharedWithMe API returns
 * Run: node scripts/debug-shared-files.js
 */

require('dotenv').config();
const microsoftAuthService = require('../services/microsoft-auth.service');
const { Client } = require('@microsoft/microsoft-graph-client');

async function debugSharedFiles() {
    console.log('\n🔍 Debugging Shared Files API\n');
    console.log('='.repeat(60));

    try {
        // 1. Check authentication
        console.log('\n1️⃣ Checking authentication...');
        const tokenResult = await microsoftAuthService.getAccessToken();
        
        if (!tokenResult.success) {
            console.error('❌ Not authenticated:', tokenResult.error);
            console.log('\n👉 Please connect to OneDrive via the UI first');
            return;
        }
        console.log('✅ Authenticated');

        // 2. Get Graph client
        const client = Client.init({
            authProvider: (done) => done(null, tokenResult.accessToken)
        });

        // 3. Get user info
        console.log('\n2️⃣ Getting user info...');
        const me = await client.api('/me').select('displayName,mail,userPrincipalName').get();
        console.log(`   User: ${me.displayName} (${me.mail || me.userPrincipalName})`);

        // 4. Get personal drive info
        console.log('\n3️⃣ Getting personal drive info...');
        const myDrive = await client.api('/me/drive').select('id,name,driveType').get();
        console.log(`   Drive ID: ${myDrive.id}`);
        console.log(`   Drive Name: ${myDrive.name}`);
        console.log(`   Drive Type: ${myDrive.driveType}`);

        // 5. Call sharedWithMe endpoint - get ALL items, not just Excel
        console.log('\n4️⃣ Calling /me/drive/sharedWithMe API...');
        const response = await client.api('/me/drive/sharedWithMe')
            .select('id,name,file,folder,parentReference,webUrl,lastModifiedDateTime,remoteItem,createdBy,shared')
            .top(100)
            .get();

        console.log(`\n   📦 Total items returned: ${response.value?.length || 0}`);

        if (!response.value || response.value.length === 0) {
            console.log('\n   ⚠️ No items returned by sharedWithMe API');
            console.log('\n   Possible reasons:');
            console.log('   - Files were shared via LINK, not "Share with people"');
            console.log('   - Propagation delay (can take hours)');
            console.log('   - Files are in SharePoint sites, not personal OneDrive');
            console.log('   - Token missing required scopes');
            
            // Check token scopes
            console.log('\n5️⃣ Checking token scopes...');
            const tokenParts = tokenResult.accessToken.split('.');
            if (tokenParts.length === 3) {
                try {
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                    console.log(`   Scopes: ${payload.scp || 'Not found in token'}`);
                } catch (e) {
                    console.log('   Could not decode token');
                }
            }
        } else {
            console.log('\n   📋 Items found:');
            console.log('   ' + '-'.repeat(56));
            
            response.value.forEach((item, i) => {
                const name = item.remoteItem?.name || item.name;
                const isFolder = !!item.folder || !!item.remoteItem?.folder;
                const isExcel = name?.toLowerCase().endsWith('.xlsx');
                const driveId = item.remoteItem?.parentReference?.driveId || item.parentReference?.driveId;
                const sharedBy = item.shared?.owner?.user?.displayName || 
                                 item.shared?.sharedBy?.user?.displayName ||
                                 item.createdBy?.user?.displayName || 
                                 'Unknown';
                
                const icon = isFolder ? '📁' : (isExcel ? '📊' : '📄');
                const type = isFolder ? 'FOLDER' : (isExcel ? 'EXCEL' : 'FILE');
                
                console.log(`\n   ${i + 1}. ${icon} ${name}`);
                console.log(`      Type: ${type}`);
                console.log(`      Shared by: ${sharedBy}`);
                console.log(`      Drive ID: ${driveId?.substring(0, 30)}...`);
                if (item.webUrl) {
                    console.log(`      URL: ${item.webUrl.substring(0, 60)}...`);
                }
            });

            // Summary
            const excelFiles = response.value.filter(item => {
                const name = item.remoteItem?.name || item.name;
                return name?.toLowerCase().endsWith('.xlsx');
            });
            const folders = response.value.filter(item => item.folder || item.remoteItem?.folder);
            
            console.log('\n   ' + '-'.repeat(56));
            console.log(`\n   📊 Summary:`);
            console.log(`      Excel files: ${excelFiles.length}`);
            console.log(`      Folders: ${folders.length}`);
            console.log(`      Other files: ${response.value.length - excelFiles.length - folders.length}`);
        }

        // 6. Try alternative: search in root/shared
        console.log('\n6️⃣ Trying alternative: /me/drive/root/search...');
        try {
            const searchResponse = await client.api("/me/drive/root/search(q='.xlsx')")
                .select('id,name,parentReference,webUrl,shared')
                .top(20)
                .get();
            
            const sharedInSearch = (searchResponse.value || []).filter(item => item.shared);
            console.log(`   Found ${sharedInSearch.length} shared Excel files via search`);
            
            if (sharedInSearch.length > 0) {
                console.log('   These files have sharing info:');
                sharedInSearch.slice(0, 5).forEach(f => {
                    console.log(`   - ${f.name}`);
                });
            }
        } catch (e) {
            console.log(`   Search failed: ${e.message}`);
        }

        // 7. Check followed SharePoint sites
        console.log('\n7️⃣ Checking followed SharePoint sites...');
        try {
            const sitesResponse = await client.api('/me/followedSites')
                .select('id,displayName,webUrl')
                .top(20)
                .get();
            
            console.log(`   Found ${sitesResponse.value?.length || 0} followed sites`);
            
            if (sitesResponse.value && sitesResponse.value.length > 0) {
                for (const site of sitesResponse.value.slice(0, 3)) {
                    console.log(`\n   📍 ${site.displayName}`);
                    console.log(`      URL: ${site.webUrl}`);
                    
                    // Try to list document libraries in this site
                    try {
                        const drivesResponse = await client.api(`/sites/${site.id}/drives`)
                            .select('id,name,driveType')
                            .get();
                        
                        for (const drive of drivesResponse.value || []) {
                            console.log(`      📂 Library: ${drive.name}`);
                            
                            // Try to find Excel files
                            try {
                                const filesResponse = await client.api(`/drives/${drive.id}/root/children`)
                                    .filter("file ne null")
                                    .select('id,name')
                                    .top(5)
                                    .get();
                                
                                const excelFiles = (filesResponse.value || [])
                                    .filter(f => f.name?.toLowerCase().endsWith('.xlsx'));
                                
                                if (excelFiles.length > 0) {
                                    console.log(`         Excel files: ${excelFiles.map(f => f.name).join(', ')}`);
                                }
                            } catch (e) {
                                // Ignore file listing errors
                            }
                        }
                    } catch (e) {
                        console.log(`      Could not access site: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            console.log(`   Could not get followed sites: ${e.message}`);
        }

        // 8. Check recent files (might include shared files)
        console.log('\n8️⃣ Checking recent files...');
        try {
            const recentResponse = await client.api('/me/drive/recent')
                .select('id,name,parentReference,webUrl,remoteItem')
                .top(20)
                .get();
            
            const recentExcel = (recentResponse.value || [])
                .filter(item => {
                    const name = item.remoteItem?.name || item.name;
                    return name?.toLowerCase().endsWith('.xlsx');
                });
            
            console.log(`   Found ${recentExcel.length} recent Excel files`);
            
            // Check which ones are from different drives (shared)
            const sharedRecent = recentExcel.filter(item => {
                const driveId = item.remoteItem?.parentReference?.driveId || item.parentReference?.driveId;
                return driveId && driveId !== myDrive.id;
            });
            
            if (sharedRecent.length > 0) {
                console.log(`   📊 Recent files from OTHER drives (shared):`);
                sharedRecent.forEach(f => {
                    const name = f.remoteItem?.name || f.name;
                    console.log(`      - ${name}`);
                });
            }
        } catch (e) {
            console.log(`   Could not get recent files: ${e.message}`);
        }

        // 9. Try Microsoft Search API (searches across all accessible content)
        console.log('\n9️⃣ Trying Microsoft Search API...');
        try {
            const searchRequest = {
                requests: [{
                    entityTypes: ['driveItem'],
                    query: {
                        queryString: 'filetype:xlsx'
                    },
                    from: 0,
                    size: 25
                }]
            };
            
            const searchResponse = await client.api('/search/query')
                .post(searchRequest);
            
            const hits = searchResponse.value?.[0]?.hitsContainers?.[0]?.hits || [];
            console.log(`   Found ${hits.length} Excel files across all accessible content`);
            
            if (hits.length > 0) {
                console.log('\n   📊 Files found via search:');
                hits.slice(0, 10).forEach((hit, i) => {
                    const resource = hit.resource;
                    const name = resource.name;
                    const webUrl = resource.webUrl || '';
                    const isFromOtherDrive = !webUrl.includes('/personal/kaplana_moodys_com/');
                    
                    if (isFromOtherDrive) {
                        console.log(`   ${i + 1}. 📊 ${name}`);
                        console.log(`      URL: ${webUrl.substring(0, 70)}...`);
                    }
                });
            }
        } catch (e) {
            console.log(`   Search API failed: ${e.message}`);
            if (e.code) console.log(`   Error code: ${e.code}`);
        }

        // 10. Check token scopes
        console.log('\n🔑 Checking token scopes...');
        const tokenParts = tokenResult.accessToken.split('.');
        if (tokenParts.length === 3) {
            try {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                console.log(`   Scopes in token: ${payload.scp || 'Not found'}`);
                console.log(`   Audience: ${payload.aud}`);
            } catch (e) {
                console.log('   Could not decode token');
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('Debug complete\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.code) {
            console.error('   Code:', error.code);
        }
        if (error.body) {
            try {
                const body = JSON.parse(error.body);
                console.error('   Details:', body.error?.message);
            } catch (e) {}
        }
    }
}

debugSharedFiles();
