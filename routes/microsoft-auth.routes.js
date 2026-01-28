/**
 * Microsoft Authentication Routes
 * OAuth 2.0 endpoints for Microsoft Graph API authentication
 */

const express = require('express');
const router = express.Router();
const microsoftAuthService = require('../services/microsoft-auth.service');
const graphExcelService = require('../services/microsoft-graph-excel.service');
const currentAccountsService = require('../services/current-accounts.service');

/**
 * GET /api/auth/microsoft/status
 * Check Microsoft connection status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await microsoftAuthService.getConnectionStatus();
        const config = graphExcelService.getConfig();
        
        res.json({
            success: true,
            ...status,
            savedFile: config.itemId ? {
                driveId: config.driveId,
                itemId: config.itemId,
                fileName: config.fileName,
                worksheetName: config.worksheetName,
                lastUpdated: config.lastUpdated
            } : null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error checking Microsoft status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/login
 * Start OAuth login flow - returns auth URL
 */
router.get('/login', async (req, res) => {
    try {
        if (!microsoftAuthService.isConfigured()) {
            return res.status(400).json({
                success: false,
                error: 'Microsoft Graph API not configured. Please add Azure credentials to .env file.',
                timestamp: new Date().toISOString()
            });
        }

        const authUrl = await microsoftAuthService.getAuthUrl();
        
        res.json({
            success: true,
            authUrl,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error generating auth URL:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/callback
 * OAuth callback - exchange code for tokens
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, error, error_description } = req.query;

        if (error) {
            console.error('OAuth error:', error, error_description);
            // Show error page that can be closed
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>OneDrive Connection Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h2 style="color: #dc2626;">❌ Connection Failed</h2>
                    <p>${error_description || error}</p>
                    <p style="color: #666;">You can close this window and try again.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                </body>
                </html>
            `);
        }

        if (!code) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>OneDrive Connection Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h2 style="color: #dc2626;">❌ Connection Failed</h2>
                    <p>No authorization code received</p>
                    <p style="color: #666;">You can close this window and try again.</p>
                </body>
                </html>
            `);
        }

        const result = await microsoftAuthService.acquireTokenByCode(code);
        
        if (result.success) {
            // Show success page that auto-closes
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>OneDrive Connected</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h2 style="color: #16a34a;">✅ Connected to OneDrive!</h2>
                    <p>Signed in as <strong>${result.account?.username || 'User'}</strong></p>
                    <p style="color: #666;">This window will close automatically...</p>
                    <p style="color: #666; font-size: 14px;">Go back to the app and refresh the modal to continue.</p>
                    <script>
                        // Try to close the popup window
                        setTimeout(() => {
                            window.close();
                        }, 2000);
                    </script>
                </body>
                </html>
            `);
        } else {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>OneDrive Connection Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h2 style="color: #dc2626;">❌ Connection Failed</h2>
                    <p>${result.error}</p>
                    <p style="color: #666;">You can close this window and try again.</p>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('❌ Error in OAuth callback:', error);
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>OneDrive Connection Failed</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h2 style="color: #dc2626;">❌ Connection Failed</h2>
                <p>${error.message}</p>
                <p style="color: #666;">You can close this window and try again.</p>
            </body>
            </html>
        `);
    }
});

/**
 * POST /api/auth/microsoft/logout
 * Sign out from Microsoft
 */
router.post('/logout', async (req, res) => {
    try {
        const result = await microsoftAuthService.signOut();
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error signing out:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/files
 * List Excel files in OneDrive
 */
router.get('/files', async (req, res) => {
    try {
        const { folderId } = req.query;
        const result = await graphExcelService.listOneDriveFiles(folderId || 'root');
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error listing files:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/search
 * Search for Excel files in OneDrive
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await graphExcelService.searchExcelFiles(q);
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error searching files:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/list-personal
 * List all Excel files in user's personal OneDrive
 */
router.get('/list-personal', async (req, res) => {
    try {
        const result = await graphExcelService.listAllPersonalExcelFiles();
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error listing personal files:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/list-shared
 * List all Excel files shared with the user
 */
router.get('/list-shared', async (req, res) => {
    try {
        const result = await graphExcelService.listAllSharedExcelFiles();
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error listing shared files:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/microsoft/resolve-share-link
 * Resolve a OneDrive/SharePoint sharing link to get file info
 */
router.post('/resolve-share-link', async (req, res) => {
    try {
        const { shareLink } = req.body;
        
        if (!shareLink) {
            return res.status(400).json({
                success: false,
                error: 'shareLink is required',
                timestamp: new Date().toISOString()
            });
        }
        
        const result = await graphExcelService.resolveShareLink(shareLink);
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error resolving share link:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/worksheets
 * Get worksheets from an Excel file
 */
router.get('/worksheets', async (req, res) => {
    try {
        const { driveId, itemId } = req.query;
        
        if (!driveId || !itemId) {
            return res.status(400).json({
                success: false,
                error: 'driveId and itemId are required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await graphExcelService.getWorksheets(driveId, itemId);
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error getting worksheets:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/microsoft/update-excel
 * Update an Excel file via Graph API
 */
router.post('/update-excel', async (req, res) => {
    try {
        const { driveId, itemId, worksheetName, fileName } = req.body;
        
        if (!driveId || !itemId || !worksheetName) {
            return res.status(400).json({
                success: false,
                error: 'driveId, itemId, and worksheetName are required',
                timestamp: new Date().toISOString()
            });
        }

        // Get all active accounts
        const accountsResult = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000,
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: false
        });

        if (!accountsResult.success) {
            return res.status(500).json({
                success: false,
                error: accountsResult.error || 'Failed to fetch accounts',
                timestamp: new Date().toISOString()
            });
        }

        const accounts = accountsResult.accounts || [];

        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No accounts to export. Please sync data first.',
                timestamp: new Date().toISOString()
            });
        }

        // Save the file info for future use
        graphExcelService.saveConfig({ driveId, itemId, fileName, worksheetName });

        // Update the worksheet
        const result = await graphExcelService.updateWorksheet(driveId, itemId, worksheetName, accounts);
        
        res.json({
            ...result,
            recordCount: accounts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error updating Excel:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/microsoft/quick-update
 * Quick update using saved configuration
 */
router.post('/quick-update', async (req, res) => {
    try {
        // Get all active accounts
        const accountsResult = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000,
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: false
        });

        if (!accountsResult.success) {
            return res.status(500).json({
                success: false,
                error: accountsResult.error || 'Failed to fetch accounts',
                timestamp: new Date().toISOString()
            });
        }

        const accounts = accountsResult.accounts || [];

        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No accounts to export. Please sync data first.',
                timestamp: new Date().toISOString()
            });
        }

        const result = await graphExcelService.quickUpdate(accounts);
        
        res.json({
            ...result,
            recordCount: accounts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in quick update:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/microsoft/create-worksheet
 * Create a new worksheet in an existing Excel file
 */
router.post('/create-worksheet', async (req, res) => {
    try {
        const { driveId, itemId, worksheetName, fileName } = req.body;
        
        if (!driveId || !itemId || !worksheetName) {
            return res.status(400).json({
                success: false,
                error: 'driveId, itemId, and worksheetName are required',
                timestamp: new Date().toISOString()
            });
        }

        // Get all active accounts
        const accountsResult = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000,
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: false
        });

        if (!accountsResult.success) {
            return res.status(500).json({
                success: false,
                error: accountsResult.error || 'Failed to fetch accounts',
                timestamp: new Date().toISOString()
            });
        }

        const accounts = accountsResult.accounts || [];

        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No accounts to export. Please sync data first.',
                timestamp: new Date().toISOString()
            });
        }

        // Save the file info for future use
        graphExcelService.saveConfig({ driveId, itemId, fileName, worksheetName });

        // Create the new worksheet and populate with data
        const result = await graphExcelService.createWorksheet(driveId, itemId, worksheetName, accounts);
        
        res.json({
            ...result,
            recordCount: accounts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error creating worksheet:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/auth/microsoft/create-excel
 * Create a new Excel file in OneDrive
 */
router.post('/create-excel', async (req, res) => {
    try {
        const { fileName, worksheetName = 'Current Accounts', folderId = 'root' } = req.body;
        
        if (!fileName) {
            return res.status(400).json({
                success: false,
                error: 'fileName is required',
                timestamp: new Date().toISOString()
            });
        }

        // Get all active accounts
        const accountsResult = await currentAccountsService.getAccounts({
            page: 1,
            pageSize: 10000,
            sortBy: 'completion_date',
            sortOrder: 'DESC',
            includeRemoved: false
        });

        if (!accountsResult.success) {
            return res.status(500).json({
                success: false,
                error: accountsResult.error || 'Failed to fetch accounts',
                timestamp: new Date().toISOString()
            });
        }

        const accounts = accountsResult.accounts || [];

        if (accounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No accounts to export. Please sync data first.',
                timestamp: new Date().toISOString()
            });
        }

        // Create the new Excel file
        const result = await graphExcelService.createExcelFile(fileName, worksheetName, accounts, folderId);
        
        res.json({
            ...result,
            recordCount: accounts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error creating Excel file:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/auth/microsoft/config
 * Get saved OneDrive file configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = graphExcelService.getConfig();
        
        res.json({
            success: true,
            config,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error getting config:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
