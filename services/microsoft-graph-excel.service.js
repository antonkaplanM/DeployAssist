/**
 * Microsoft Graph Excel Service
 * Handles Excel file operations via Microsoft Graph API (supports co-authoring)
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const microsoftAuthService = require('./microsoft-auth.service');
const fs = require('fs');
const path = require('path');

// Config file for storing OneDrive file settings
const CONFIG_FILE = path.join(__dirname, '..', 'config', 'onedrive-excel-config.json');
// Config file for storing files added via sharing links
const LINKED_FILES_CONFIG = path.join(__dirname, '..', 'config', 'onedrive-linked-files.json');

class MicrosoftGraphExcelService {
    constructor() {
        this.ensureConfigDir();
    }

    /**
     * Check if a filename is an Excel file (.xlsx or .xlsm)
     */
    isExcelFile(fileName) {
        if (!fileName) return false;
        const lower = fileName.toLowerCase();
        return lower.endsWith('.xlsx') || lower.endsWith('.xlsm');
    }

    /**
     * Ensure the config directory exists
     */
    ensureConfigDir() {
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
    }

    /**
     * Get saved linked files (files added via share link)
     */
    getLinkedFiles() {
        try {
            if (fs.existsSync(LINKED_FILES_CONFIG)) {
                const data = JSON.parse(fs.readFileSync(LINKED_FILES_CONFIG, 'utf8'));
                return data.files || [];
            }
        } catch (error) {
            console.warn('Error reading linked files config:', error.message);
        }
        return [];
    }

    /**
     * Save a file that was added via share link
     */
    saveLinkedFile(file) {
        try {
            const files = this.getLinkedFiles();
            
            // Check if already exists
            const exists = files.some(f => f.id === file.id && f.driveId === file.driveId);
            if (!exists) {
                files.push({
                    id: file.id,
                    driveId: file.driveId,
                    name: file.name,
                    webUrl: file.webUrl,
                    addedAt: new Date().toISOString()
                });
                
                fs.writeFileSync(LINKED_FILES_CONFIG, JSON.stringify({ files }, null, 2));
                console.log(`📁 Saved linked file: ${file.name}`);
            }
        } catch (error) {
            console.warn('Error saving linked file:', error.message);
        }
    }

    /**
     * Get Graph API client with current access token
     */
    async getGraphClient() {
        const tokenResult = await microsoftAuthService.getAccessToken();
        
        if (!tokenResult.success) {
            throw new Error(tokenResult.error || 'Failed to get access token');
        }

        const client = Client.init({
            authProvider: (done) => {
                done(null, tokenResult.accessToken);
            }
        });

        return client;
    }

    /**
     * Get saved OneDrive Excel configuration
     */
    getConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const data = fs.readFileSync(CONFIG_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error reading OneDrive Excel config:', error);
        }
        return {
            driveId: null,
            itemId: null,
            fileName: null,
            worksheetId: null,
            worksheetName: null,
            lastUpdated: null
        };
    }

    /**
     * Save OneDrive Excel configuration
     */
    saveConfig(config) {
        try {
            const currentConfig = this.getConfig();
            const newConfig = {
                ...currentConfig,
                ...config,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
            return { success: true, config: newConfig };
        } catch (error) {
            console.error('Error saving OneDrive Excel config:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List files in user's OneDrive root
     */
    async listOneDriveFiles(folderId = 'root', searchQuery = null) {
        try {
            const client = await this.getGraphClient();
            
            let endpoint = `/me/drive/${folderId === 'root' ? 'root' : `items/${folderId}`}/children`;
            
            // Filter for Excel files
            const response = await client.api(endpoint)
                .filter("file ne null")
                .select('id,name,file,parentReference,webUrl,lastModifiedDateTime')
                .top(100)
                .get();

            // Filter to only Excel files (.xlsx, .xlsm)
            const excelFiles = response.value.filter(item => 
                this.isExcelFile(item.name)
            );

            return {
                success: true,
                files: excelFiles.map(file => ({
                    id: file.id,
                    name: file.name,
                    webUrl: file.webUrl,
                    lastModified: file.lastModifiedDateTime,
                    driveId: file.parentReference?.driveId
                }))
            };
        } catch (error) {
            console.error('Error listing OneDrive files:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List ALL Excel files from personal OneDrive (recursive search)
     */
    async listAllPersonalExcelFiles() {
        try {
            const client = await this.getGraphClient();
            
            // Use search with wildcard to find all Excel files
            // Note: Search for .xls to match both .xlsx and .xlsm
            const response = await client.api('/me/drive/root/search(q=\'.xls\')')
                .select('id,name,file,parentReference,webUrl,lastModifiedDateTime')
                .top(200)
                .get();

            const excelFiles = (response.value || [])
                .filter(item => this.isExcelFile(item.name))
                .map(file => ({
                    id: file.id,
                    name: file.name,
                    webUrl: file.webUrl,
                    lastModified: file.lastModifiedDateTime,
                    driveId: file.parentReference?.driveId,
                    path: file.parentReference?.path?.replace('/drive/root:', '') || '/',
                    source: 'OneDrive'
                }))
                .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

            console.log(`📁 Listed ${excelFiles.length} personal Excel files`);

            return {
                success: true,
                files: excelFiles
            };
        } catch (error) {
            console.error('Error listing personal Excel files:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List ALL Excel files shared with the user
     * Also includes files accessed via share links (from saved config)
     */
    async listAllSharedExcelFiles() {
        try {
            const client = await this.getGraphClient();
            const allSharedFiles = [];
            
            // Get user's personal drive ID to filter out personal files
            let myDriveId = null;
            try {
                const myDrive = await client.api('/me/drive').select('id').get();
                myDriveId = myDrive.id;
                console.log(`📁 My drive ID: ${myDriveId}`);
            } catch (e) {
                console.warn('Could not get personal drive ID:', e.message);
            }
            
            // 1. Get files from sharedWithMe endpoint
            try {
                const response = await client.api('/me/drive/sharedWithMe')
                    .select('id,name,file,parentReference,webUrl,lastModifiedDateTime,remoteItem,createdBy,shared')
                    .top(200)
                    .get();

                console.log(`📁 sharedWithMe returned: ${response.value?.length || 0} items`);
                
                // Log all items for debugging
                (response.value || []).forEach((item, i) => {
                    const name = item.remoteItem?.name || item.name;
                    const driveId = item.remoteItem?.parentReference?.driveId || item.parentReference?.driveId;
                    console.log(`   [${i}] ${name} (driveId: ${driveId?.substring(0, 20)}...)`);
                });

                const sharedFiles = (response.value || [])
                    .filter(item => {
                        const name = item.remoteItem?.name || item.name;
                        return this.isExcelFile(name);
                    })
                    .map(file => {
                        const remoteItem = file.remoteItem || file;
                        const sharedBy = file.shared?.owner?.user?.displayName || 
                                         file.shared?.sharedBy?.user?.displayName ||
                                         file.createdBy?.user?.displayName || 
                                         'Someone';
                        return {
                            id: remoteItem.id,
                            name: remoteItem.name || file.name,
                            webUrl: remoteItem.webUrl || file.webUrl,
                            lastModified: remoteItem.lastModifiedDateTime || file.lastModifiedDateTime,
                            driveId: remoteItem.parentReference?.driveId,
                            path: 'Shared with me',
                            source: 'Shared',
                            sharedBy: sharedBy
                        };
                    });

                allSharedFiles.push(...sharedFiles);
            } catch (e) {
                console.warn('Could not fetch sharedWithMe:', e.message);
            }

            // 2. Add the saved file ONLY if it's from a different drive (truly shared file)
            try {
                const config = this.getConfig();
                if (config.driveId && config.itemId && config.fileName) {
                    // Only add if it's from a different drive (not user's personal drive)
                    const isFromDifferentDrive = myDriveId && config.driveId !== myDriveId;
                    
                    if (isFromDifferentDrive) {
                        // Check if this file is already in the list
                        const alreadyInList = allSharedFiles.some(f => 
                            f.id === config.itemId && f.driveId === config.driveId
                        );
                        
                        if (!alreadyInList) {
                            // Try to get file info to verify it's still accessible
                            try {
                                const fileInfo = await client.api(`/drives/${config.driveId}/items/${config.itemId}`)
                                    .select('id,name,webUrl,lastModifiedDateTime,createdBy')
                                    .get();
                                
                                allSharedFiles.unshift({
                                    id: config.itemId,
                                    name: fileInfo.name || config.fileName,
                                    webUrl: fileInfo.webUrl,
                                    lastModified: fileInfo.lastModifiedDateTime,
                                    driveId: config.driveId,
                                    path: 'Previously accessed',
                                    source: 'Shared',
                                    sharedBy: fileInfo.createdBy?.user?.displayName || 'Via link'
                                });
                                console.log(`📁 Added saved file to shared list: ${config.fileName}`);
                            } catch (e) {
                                console.log(`📁 Saved file not accessible: ${config.fileName}`);
                            }
                        }
                    } else {
                        console.log(`📁 Saved file is from personal drive, not adding to shared: ${config.fileName}`);
                    }
                }
            } catch (e) {
                // Ignore config errors
            }

            // 3. Add saved linked files (files added via share link)
            try {
                const linkedFiles = this.getLinkedFiles();
                console.log(`📁 Found ${linkedFiles.length} saved linked files`);
                
                for (const linkedFile of linkedFiles) {
                    // Skip if from personal drive
                    if (myDriveId && linkedFile.driveId === myDriveId) {
                        continue;
                    }
                    
                    // Check if already in list
                    const alreadyInList = allSharedFiles.some(f => 
                        f.id === linkedFile.id && f.driveId === linkedFile.driveId
                    );
                    
                    if (!alreadyInList) {
                        // Try to get current file info
                        try {
                            const fileInfo = await client.api(`/drives/${linkedFile.driveId}/items/${linkedFile.id}`)
                                .select('id,name,webUrl,lastModifiedDateTime,createdBy')
                                .get();
                            
                            allSharedFiles.push({
                                id: linkedFile.id,
                                name: fileInfo.name || linkedFile.name,
                                webUrl: fileInfo.webUrl || linkedFile.webUrl,
                                lastModified: fileInfo.lastModifiedDateTime,
                                driveId: linkedFile.driveId,
                                path: 'Added via link',
                                source: 'Shared',
                                sharedBy: fileInfo.createdBy?.user?.displayName || 'Via link'
                            });
                            console.log(`📁 Added linked file: ${linkedFile.name}`);
                        } catch (e) {
                            console.log(`📁 Linked file no longer accessible: ${linkedFile.name}`);
                        }
                    }
                }
            } catch (e) {
                console.warn('Error loading linked files:', e.message);
            }

            // 4. Use Microsoft Search API to find additional shared Excel files
            // This finds files from SharePoint sites and other users' OneDrive
            try {
                const searchRequest = {
                    requests: [{
                        entityTypes: ['driveItem'],
                        query: {
                            queryString: 'filetype:xlsx'
                        },
                        from: 0,
                        size: 50
                    }]
                };
                
                const searchResponse = await client.api('/search/query').post(searchRequest);
                const hits = searchResponse.value?.[0]?.hitsContainers?.[0]?.hits || [];
                
                console.log(`📁 Search API found ${hits.length} Excel files`);
                
                let addedFromSearch = 0;
                for (const hit of hits) {
                    const resource = hit.resource;
                    if (!resource || !this.isExcelFile(resource.name)) continue;
                    
                    // Extract drive ID from the resource
                    const driveId = resource.parentReference?.driveId;
                    if (!driveId) continue;
                    
                    // Skip files from personal drive
                    if (driveId === myDriveId) continue;
                    
                    // Check if already in list
                    const alreadyInList = allSharedFiles.some(f => 
                        f.id === resource.id && f.driveId === driveId
                    );
                    
                    if (!alreadyInList) {
                        // Determine source type from URL
                        const webUrl = resource.webUrl || '';
                        let source = 'Shared';
                        let path = 'Found via search';
                        
                        if (webUrl.includes('/sites/')) {
                            source = 'SharePoint';
                            // Extract site name from URL
                            const siteMatch = webUrl.match(/\/sites\/([^/]+)/);
                            if (siteMatch) {
                                path = siteMatch[1].replace(/_/g, ' ');
                            }
                        } else if (webUrl.includes('/personal/')) {
                            // File from another user's OneDrive
                            const userMatch = webUrl.match(/\/personal\/([^/]+)/);
                            if (userMatch) {
                                const userName = userMatch[1].split('_')[0];
                                path = `${userName}'s OneDrive`;
                            }
                        }
                        
                        allSharedFiles.push({
                            id: resource.id,
                            name: resource.name,
                            webUrl: resource.webUrl,
                            lastModified: resource.lastModifiedDateTime,
                            driveId: driveId,
                            path: path,
                            source: source,
                            sharedBy: resource.createdBy?.user?.displayName || 'Via search'
                        });
                        addedFromSearch++;
                    }
                }
                
                console.log(`📁 Added ${addedFromSearch} files from search`);
            } catch (e) {
                console.warn('Search API failed (may need Sites.Read.All):', e.message);
            }

            // Remove duplicates
            const uniqueFiles = allSharedFiles.filter((file, index, self) =>
                index === self.findIndex(f => f.id === file.id && f.driveId === file.driveId)
            );

            console.log(`📁 Total shared Excel files: ${uniqueFiles.length}`);

            return {
                success: true,
                files: uniqueFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
            };
        } catch (error) {
            console.error('Error listing shared Excel files:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Resolve a OneDrive/SharePoint sharing link to get file info
     * This allows users to add files shared via link that don't appear in sharedWithMe
     */
    async resolveShareLink(shareLink) {
        try {
            const client = await this.getGraphClient();
            
            // SharePoint/OneDrive share links can be resolved using the shares endpoint
            // The link needs to be encoded as a "sharing token"
            // Format: u!{base64url_encoded_link}
            
            // Base64url encode the share link
            const encodedUrl = Buffer.from(shareLink, 'utf-8').toString('base64')
                .replace(/=/g, '')
                .replace(/\+/g, '-')
                .replace(/\//g, '_');
            const shareToken = `u!${encodedUrl}`;
            
            console.log(`🔗 Resolving share link: ${shareLink.substring(0, 50)}...`);
            
            // Call the shares endpoint to get the shared item
            const sharedItem = await client.api(`/shares/${shareToken}/driveItem`)
                .select('id,name,file,parentReference,webUrl,lastModifiedDateTime,createdBy')
                .get();
            
            if (!sharedItem) {
                return { success: false, error: 'Could not resolve the sharing link' };
            }
            
            // Check if it's an Excel file (.xlsx or .xlsm)
            const fileName = sharedItem.name || '';
            if (!this.isExcelFile(fileName)) {
                return { 
                    success: false, 
                    error: 'The shared item is not an Excel file (.xlsx or .xlsm)' 
                };
            }
            
            const driveId = sharedItem.parentReference?.driveId;
            if (!driveId) {
                return { success: false, error: 'Could not determine the file location' };
            }
            
            const file = {
                id: sharedItem.id,
                name: sharedItem.name,
                webUrl: sharedItem.webUrl,
                lastModified: sharedItem.lastModifiedDateTime,
                driveId: driveId,
                path: 'Added via link',
                source: 'Shared',
                sharedBy: sharedItem.createdBy?.user?.displayName || 'Via link'
            };
            
            console.log(`✅ Resolved share link to: ${file.name} (driveId: ${driveId}, itemId: ${file.id})`);
            
            // Save the linked file for future reference
            this.saveLinkedFile(file);
            
            return { success: true, file };
        } catch (error) {
            console.error('Error resolving share link:', error);
            
            // Provide more helpful error messages
            if (error.code === 'itemNotFound') {
                return { 
                    success: false, 
                    error: 'The shared file was not found. The link may be invalid or you may not have access.' 
                };
            }
            if (error.code === 'accessDenied') {
                return { 
                    success: false, 
                    error: 'Access denied. You may need to request access to this file or the sharing link may have expired.' 
                };
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Search for Excel files in OneDrive (personal + shared)
     */
    async searchExcelFiles(query) {
        try {
            const client = await this.getGraphClient();
            const allFiles = [];

            // 1. Search personal OneDrive
            try {
                const personalResponse = await client.api('/me/drive/root/search(q=\'' + query + '\')')
                    .select('id,name,file,parentReference,webUrl,lastModifiedDateTime')
                    .top(30)
                    .get();
                
                const personalFiles = (personalResponse.value || [])
                    .filter(item => this.isExcelFile(item.name))
                    .map(file => ({
                        id: file.id,
                        name: file.name,
                        webUrl: file.webUrl,
                        lastModified: file.lastModifiedDateTime,
                        driveId: file.parentReference?.driveId,
                        path: file.parentReference?.path?.replace('/drive/root:', '') || 'OneDrive',
                        source: 'OneDrive'
                    }));
                
                allFiles.push(...personalFiles);
                console.log(`📁 Found ${personalFiles.length} files in personal OneDrive`);
            } catch (e) {
                console.warn('Could not search personal OneDrive:', e.message);
            }

            // 2. Search files shared with me
            try {
                const sharedResponse = await client.api('/me/drive/sharedWithMe')
                    .select('id,name,file,parentReference,webUrl,lastModifiedDateTime,remoteItem')
                    .top(100)
                    .get();
                
                const sharedFiles = (sharedResponse.value || [])
                    .filter(item => {
                        const name = item.remoteItem?.name || item.name;
                        return this.isExcelFile(name) && 
                               name.toLowerCase().includes(query.toLowerCase());
                    })
                    .map(file => {
                        const remoteItem = file.remoteItem || file;
                        return {
                            id: remoteItem.id,
                            name: remoteItem.name || file.name,
                            webUrl: remoteItem.webUrl || file.webUrl,
                            lastModified: remoteItem.lastModifiedDateTime || file.lastModifiedDateTime,
                            driveId: remoteItem.parentReference?.driveId,
                            path: 'Shared with me',
                            source: 'Shared'
                        };
                    });
                
                allFiles.push(...sharedFiles);
                console.log(`📁 Found ${sharedFiles.length} matching shared files`);
            } catch (e) {
                console.warn('Could not search shared files:', e.message);
            }

            // 3. Search SharePoint sites the user has access to (if permissions allow)
            try {
                // Get sites the user follows or has recent activity
                const sitesResponse = await client.api('/me/followedSites')
                    .select('id,name,webUrl')
                    .top(10)
                    .get();
                
                for (const site of (sitesResponse.value || [])) {
                    try {
                        const siteSearchResponse = await client.api(`/sites/${site.id}/drive/root/search(q='${query}')`)
                            .select('id,name,file,parentReference,webUrl,lastModifiedDateTime')
                            .top(10)
                            .get();
                        
                        const siteFiles = (siteSearchResponse.value || [])
                            .filter(item => this.isExcelFile(item.name))
                            .map(file => ({
                                id: file.id,
                                name: file.name,
                                webUrl: file.webUrl,
                                lastModified: file.lastModifiedDateTime,
                                driveId: file.parentReference?.driveId,
                                path: site.name || 'SharePoint',
                                source: 'SharePoint'
                            }));
                        
                        allFiles.push(...siteFiles);
                    } catch (siteError) {
                        // Site might not have a drive or access denied
                    }
                }
            } catch (e) {
                // User might not follow any sites or no permissions
                console.log('ℹ️ Could not search SharePoint sites (may need Sites.Read.All permission)');
            }

            // Remove duplicates by file ID
            const uniqueFiles = allFiles.filter((file, index, self) =>
                index === self.findIndex(f => f.id === file.id && f.driveId === file.driveId)
            );

            console.log(`📁 Total: ${uniqueFiles.length} unique Excel files found`);

            return {
                success: true,
                files: uniqueFiles
            };
        } catch (error) {
            console.error('Error searching OneDrive files:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get worksheets from an Excel file
     */
    async getWorksheets(driveId, itemId) {
        try {
            const client = await this.getGraphClient();
            
            const response = await client.api(`/drives/${driveId}/items/${itemId}/workbook/worksheets`)
                .get();

            return {
                success: true,
                worksheets: response.value.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    position: ws.position,
                    visibility: ws.visibility
                }))
            };
        } catch (error) {
            console.error('Error getting worksheets:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear a worksheet and add new data
     */
    async updateWorksheet(driveId, itemId, worksheetName, accounts) {
        try {
            const client = await this.getGraphClient();
            const baseUrl = `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(worksheetName)}`;

            // Step 1: Get the used range to know what to clear
            let usedRange;
            try {
                usedRange = await client.api(`${baseUrl}/usedRange`).get();
            } catch (e) {
                // Worksheet might be empty, that's OK
                usedRange = null;
            }

            // Step 2: Clear existing content if there is any
            if (usedRange && usedRange.address) {
                try {
                    await client.api(`${baseUrl}/range(address='${usedRange.address}')/clear`)
                        .post({ applyTo: 'All' });
                    console.log('✅ Cleared existing content');
                } catch (e) {
                    console.warn('Could not clear range:', e.message);
                }
            }

            // Step 3: Prepare data (headers + rows)
            const headers = [
                'Client', 'Services', 'Type', 'CSM/Owner', 'PS Record', 'Completed',
                'Size', 'Region', 'Tenant', 'Tenant ID', 'SF Account ID', 
                'Tenant URL', 'Admin', 'Status', 'Comments'
            ];

            const rows = accounts.map(account => [
                account.client || '—',
                account.services || '—',
                account.account_type || '—',
                account.csm_owner || '—',
                account.ps_record_name || '—',
                account.completion_date 
                    ? new Date(account.completion_date).toLocaleDateString() 
                    : '—',
                account.size || '—',
                account.region || '—',
                account.tenant_name || '—',
                account.tenant_id || '—',
                account.salesforce_account_id || '—',
                account.tenant_url || '—',
                account.initial_tenant_admin || '—',
                account.tenant_status || 'Active',
                account.comments || ''
            ]);

            const allData = [headers, ...rows];
            const numRows = allData.length;
            const numCols = headers.length;

            // Convert column number to Excel letter (1=A, 2=B, etc.)
            const getColumnLetter = (num) => {
                let letter = '';
                while (num > 0) {
                    const remainder = (num - 1) % 26;
                    letter = String.fromCharCode(65 + remainder) + letter;
                    num = Math.floor((num - 1) / 26);
                }
                return letter;
            };

            const endColumn = getColumnLetter(numCols);
            const rangeAddress = `A1:${endColumn}${numRows}`;

            // Step 4: Write new data
            await client.api(`${baseUrl}/range(address='${rangeAddress}')`)
                .patch({
                    values: allData
                });

            console.log(`✅ Written ${numRows} rows to ${worksheetName}`);

            // Step 5: Format header row (bold, background color)
            try {
                await client.api(`${baseUrl}/range(address='A1:${endColumn}1')/format`)
                    .patch({
                        font: { bold: true, color: '#FFFFFF' },
                        fill: { color: '#4472C4' }
                    });
                console.log('✅ Applied header formatting');
            } catch (e) {
                console.warn('Could not apply formatting:', e.message);
            }

            // Step 6: Add table/auto-filter
            try {
                // Check if table already exists
                const tables = await client.api(`${baseUrl}/tables`).get();
                
                if (tables.value.length === 0) {
                    // Create a new table
                    await client.api(`${baseUrl}/tables/add`)
                        .post({
                            address: rangeAddress,
                            hasHeaders: true
                        });
                    console.log('✅ Created table with filters');
                }
            } catch (e) {
                console.warn('Could not create table:', e.message);
            }

            // Save config
            this.saveConfig({
                driveId,
                itemId,
                worksheetName
            });

            return {
                success: true,
                message: `Updated worksheet "${worksheetName}" with ${accounts.length} records`,
                rowsWritten: numRows,
                worksheetName
            };

        } catch (error) {
            console.error('Error updating worksheet:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new worksheet in an existing workbook
     */
    async createWorksheet(driveId, itemId, worksheetName, accounts) {
        try {
            const client = await this.getGraphClient();
            const baseUrl = `/drives/${driveId}/items/${itemId}/workbook/worksheets`;

            // Create new worksheet
            const newSheet = await client.api(baseUrl)
                .post({ name: worksheetName });

            console.log(`✅ Created worksheet: ${worksheetName}`);

            // Now update it with data
            return await this.updateWorksheet(driveId, itemId, worksheetName, accounts);

        } catch (error) {
            console.error('Error creating worksheet:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new Excel file in OneDrive
     */
    async createExcelFile(fileName, worksheetName, accounts, folderId = 'root') {
        try {
            const client = await this.getGraphClient();

            // Ensure filename has .xlsx extension
            if (!fileName.toLowerCase().endsWith('.xlsx')) {
                fileName += '.xlsx';
            }

            // Create an empty Excel file by uploading minimal content
            // The Graph API will recognize it as an Excel file
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(worksheetName);
            
            // Add headers
            const headers = [
                'Client', 'Services', 'Type', 'CSM/Owner', 'PS Record', 'Completed',
                'Size', 'Region', 'Tenant', 'Tenant ID', 'SF Account ID', 
                'Tenant URL', 'Admin', 'Status', 'Comments'
            ];
            worksheet.addRow(headers);

            // Add data rows
            accounts.forEach(account => {
                worksheet.addRow([
                    account.client || '—',
                    account.services || '—',
                    account.account_type || '—',
                    account.csm_owner || '—',
                    account.ps_record_name || '—',
                    account.completion_date 
                        ? new Date(account.completion_date).toLocaleDateString() 
                        : '—',
                    account.size || '—',
                    account.region || '—',
                    account.tenant_name || '—',
                    account.tenant_id || '—',
                    account.salesforce_account_id || '—',
                    account.tenant_url || '—',
                    account.initial_tenant_admin || '—',
                    account.tenant_status || 'Active',
                    account.comments || ''
                ]);
            });

            // Style header row
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer();

            // Upload to OneDrive
            const uploadPath = folderId === 'root' 
                ? `/me/drive/root:/${fileName}:/content`
                : `/me/drive/items/${folderId}:/${fileName}:/content`;

            const uploadResponse = await client.api(uploadPath)
                .put(buffer);

            console.log(`✅ Created Excel file: ${fileName}`);

            // Save config
            this.saveConfig({
                driveId: uploadResponse.parentReference?.driveId,
                itemId: uploadResponse.id,
                fileName: uploadResponse.name,
                worksheetName
            });

            return {
                success: true,
                message: `Created "${fileName}" with ${accounts.length} records`,
                fileId: uploadResponse.id,
                fileName: uploadResponse.name,
                webUrl: uploadResponse.webUrl
            };

        } catch (error) {
            console.error('Error creating Excel file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Quick update using saved configuration
     */
    async quickUpdate(accounts) {
        const config = this.getConfig();
        
        if (!config.driveId || !config.itemId || !config.worksheetName) {
            return { 
                success: false, 
                error: 'No OneDrive file configured. Please select a file first.' 
            };
        }

        return await this.updateWorksheet(
            config.driveId, 
            config.itemId, 
            config.worksheetName, 
            accounts
        );
    }

    /**
     * Convert a share URL to a base64 encoded sharing token
     * See: https://learn.microsoft.com/en-us/graph/api/shares-get
     */
    encodeSharingUrl(shareUrl) {
        // Convert the URL to base64
        const base64 = Buffer.from(shareUrl).toString('base64');
        // Convert to URL-safe base64 and add 'u!' prefix
        const urlSafeBase64 = base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return `u!${urlSafeBase64}`;
    }

    /**
     * Test access to a shared file without making changes
     * This verifies we can read the file and its worksheets
     */
    async testSharedFileAccess(shareUrl) {
        try {
            const client = await this.getGraphClient();
            const results = {
                success: false,
                steps: [],
                file: null,
                worksheets: [],
                canRead: false,
                canWrite: false,
                error: null
            };

            console.log('🔍 Testing access to shared file...');
            console.log('   URL:', shareUrl);

            // Step 1: Encode the sharing URL
            const shareToken = this.encodeSharingUrl(shareUrl);
            results.steps.push({ step: 'Encode sharing URL', status: 'success', token: shareToken.substring(0, 20) + '...' });

            // Step 2: Get the driveItem from the sharing link
            let driveItem;
            try {
                driveItem = await client.api(`/shares/${shareToken}/driveItem`)
                    .select('id,name,file,parentReference,webUrl,lastModifiedDateTime,createdBy,lastModifiedBy')
                    .get();
                
                results.file = {
                    id: driveItem.id,
                    name: driveItem.name,
                    webUrl: driveItem.webUrl,
                    driveId: driveItem.parentReference?.driveId,
                    lastModified: driveItem.lastModifiedDateTime,
                    lastModifiedBy: driveItem.lastModifiedBy?.user?.displayName || 'Unknown',
                    createdBy: driveItem.createdBy?.user?.displayName || 'Unknown'
                };
                results.steps.push({ 
                    step: 'Access shared file via sharing link', 
                    status: 'success',
                    fileName: driveItem.name,
                    driveId: driveItem.parentReference?.driveId,
                    itemId: driveItem.id
                });
                results.canRead = true;
                console.log('✅ Successfully accessed file:', driveItem.name);
            } catch (error) {
                results.steps.push({ 
                    step: 'Access shared file via sharing link', 
                    status: 'failed',
                    error: error.message 
                });
                results.error = `Cannot access shared file: ${error.message}`;
                console.error('❌ Failed to access shared file:', error.message);
                return results;
            }

            // Step 3: Try to get worksheets (this tests Excel workbook access)
            const driveId = driveItem.parentReference?.driveId;
            const itemId = driveItem.id;

            try {
                const worksheetsResponse = await client.api(`/drives/${driveId}/items/${itemId}/workbook/worksheets`)
                    .get();
                
                results.worksheets = worksheetsResponse.value.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    position: ws.position
                }));
                results.steps.push({ 
                    step: 'Read Excel worksheets', 
                    status: 'success',
                    worksheetCount: results.worksheets.length,
                    worksheets: results.worksheets.map(ws => ws.name)
                });
                console.log('✅ Successfully read worksheets:', results.worksheets.map(ws => ws.name).join(', '));
            } catch (error) {
                results.steps.push({ 
                    step: 'Read Excel worksheets', 
                    status: 'failed',
                    error: error.message 
                });
                results.error = `Cannot read worksheets: ${error.message}`;
                console.error('❌ Failed to read worksheets:', error.message);
                return results;
            }

            // Step 4: Check write permission by trying to get used range (read-only operation)
            // We can't truly test write without making a change, but we can check the permission
            try {
                // Try to access the workbook session info - this helps verify we have proper access
                const sessionInfo = await client.api(`/drives/${driveId}/items/${itemId}/workbook`)
                    .get();
                
                results.steps.push({ 
                    step: 'Access workbook (write check)', 
                    status: 'success',
                    message: 'Workbook is accessible for operations'
                });
                results.canWrite = true; // If we got here, we likely have write access
                console.log('✅ Workbook is accessible');
            } catch (error) {
                results.steps.push({ 
                    step: 'Access workbook (write check)', 
                    status: 'warning',
                    message: `May not have write access: ${error.message}`
                });
                console.warn('⚠️ May not have write access:', error.message);
            }

            // Summary
            results.success = results.canRead;
            results.summary = {
                fileFound: true,
                fileName: results.file?.name,
                worksheetCount: results.worksheets.length,
                worksheetNames: results.worksheets.map(ws => ws.name),
                canRead: results.canRead,
                canWrite: results.canWrite,
                driveId: driveId,
                itemId: itemId,
                recommendation: results.canWrite 
                    ? '✅ You should be able to update this file!'
                    : '⚠️ Read access confirmed, but write access uncertain. Try updating to confirm.'
            };

            console.log('\n📊 Test Summary:');
            console.log('   File:', results.file?.name);
            console.log('   Worksheets:', results.worksheets.map(ws => ws.name).join(', '));
            console.log('   Can Read:', results.canRead);
            console.log('   Can Write:', results.canWrite);

            return results;

        } catch (error) {
            console.error('❌ Error testing shared file access:', error);
            return {
                success: false,
                error: error.message,
                steps: [{ step: 'Initialize', status: 'failed', error: error.message }]
            };
        }
    }
}

module.exports = new MicrosoftGraphExcelService();
