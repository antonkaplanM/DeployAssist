/**
 * SML Ghost Accounts Routes
 * Handles SML ghost account management endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const SMLGhostAccountsService = require('../services/sml-ghost-accounts.service');
const SMLService = require('../services/sml.service');
const ExcelJS = require('exceljs');

// Initialize services
const smlGhostService = new SMLGhostAccountsService();
const smlServiceInstance = new SMLService(); // For auth checking and product normalization

/**
 * GET /api/sml-ghost-accounts
 * Get SML ghost accounts with optional filters
 */
router.get('/', async (req, res) => {
    try {
        console.log('👻 SML ghost accounts API called...', req.query);
        
        const filters = {
            isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
            accountSearch: req.query.accountSearch,
            expiryBefore: req.query.expiryBefore,
            expiryAfter: req.query.expiryAfter,
        };
        
        // Handle product codes (can be comma-separated string or array)
        if (req.query.productCodes) {
            filters.productCodes = typeof req.query.productCodes === 'string'
                ? req.query.productCodes.split(',').map(code => code.trim()).filter(code => code)
                : req.query.productCodes;
        }
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });
        
        console.log(`📊 Fetching SML ghost accounts with filters:`, filters);
        
        // Use the product-aware function if productCodes is provided
        const result = filters.productCodes && filters.productCodes.length > 0
            ? await db.getSMLGhostAccountsByProduct(filters)
            : await db.getSMLGhostAccounts(filters);
        const summaryResult = await db.getSMLGhostAccountsSummary();
        
        if (result.success) {
            res.json({
                success: true,
                ghostAccounts: result.ghostAccounts,
                summary: summaryResult.summary,
                dataSource: 'sml',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                ghostAccounts: [],
                summary: {
                    totalGhostAccounts: 0,
                    unreviewed: 0,
                    reviewed: 0
                }
            });
        }
    } catch (err) {
        console.error('❌ Error fetching SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch SML ghost accounts',
            ghostAccounts: []
        });
    }
});

/**
 * GET /api/sml-ghost-accounts/unique-products
 * Get unique expired products from SML ghost accounts (for filtering)
 */
router.get('/unique-products', async (req, res) => {
    try {
        console.log('🔍 Fetching unique expired products from SML ghost accounts...');
        
        const result = await db.getSMLUniqueExpiredProducts();
        
        if (result.success) {
            res.json({
                success: true,
                productsByCategory: result.productsByCategory,
                count: result.count,
                dataSource: 'sml',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                productsByCategory: { apps: [], models: [], data: [] },
                count: 0
            });
        }
    } catch (err) {
        console.error('❌ Error fetching unique expired products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch unique expired products',
            products: [],
            count: 0
        });
    }
});

/**
 * GET /api/sml-ghost-accounts/export
 * Export SML ghost accounts to Excel with expired products
 */
router.get('/export', async (req, res) => {
    try {
        console.log('📥 Exporting SML ghost accounts to Excel...');
        
        // Get filters from query params (same as regular ghost accounts endpoint)
        const filters = {
            isReviewed: req.query.isReviewed !== undefined ? req.query.isReviewed === 'true' : undefined,
            accountSearch: req.query.accountSearch,
            expiryBefore: req.query.expiryBefore,
            expiryAfter: req.query.expiryAfter,
        };
        
        // Handle product codes
        if (req.query.productCodes) {
            filters.productCodes = typeof req.query.productCodes === 'string'
                ? req.query.productCodes.split(',').map(code => code.trim()).filter(code => code)
                : req.query.productCodes;
        }
        
        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });
        
        // Fetch ghost accounts with filters
        const result = filters.productCodes && filters.productCodes.length > 0
            ? await db.getSMLGhostAccountsByProduct(filters)
            : await db.getSMLGhostAccounts(filters);
        
        if (!result.success || !result.ghostAccounts || result.ghostAccounts.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No ghost accounts found to export'
            });
        }
        
        const ghostAccounts = result.ghostAccounts;
        
        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ghost Accounts');
        
        // Define columns
        worksheet.columns = [
            { header: 'Tenant ID', key: 'tenantId', width: 15 },
            { header: 'Tenant Name', key: 'tenantName', width: 25 },
            { header: 'Account Name', key: 'accountName', width: 25 },
            { header: 'Total Expired Products', key: 'totalExpiredProducts', width: 20 },
            { header: 'Latest Expiry Date', key: 'latestExpiryDate', width: 18 },
            { header: 'Days Since Expiry', key: 'daysSinceExpiry', width: 18 },
            { header: 'Review Status', key: 'reviewStatus', width: 15 },
            { header: 'Reviewed At', key: 'reviewedAt', width: 18 },
            { header: 'Reviewed By', key: 'reviewedBy', width: 20 },
            { header: 'Expired Products', key: 'expiredProducts', width: 50 },
            { header: 'Product Categories', key: 'productCategories', width: 30 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Fetch products for each ghost account and add rows
        for (const account of ghostAccounts) {
            // Fetch products for this tenant
            const tenantResult = await db.getSMLTenantById(account.tenant_id);
            
            let expiredProductsList = [];
            let productCategories = new Set();
            
            if (tenantResult.success && tenantResult.tenant) {
                const tenant = tenantResult.tenant;
                const productEntitlements = typeof tenant.product_entitlements === 'string' 
                    ? JSON.parse(tenant.product_entitlements)
                    : tenant.product_entitlements;
                
                if (productEntitlements) {
                    // Normalize products using SML service
                    const appsRaw = productEntitlements.appEntitlements || [];
                    const modelsRaw = productEntitlements.modelEntitlements || [];
                    const dataRaw = productEntitlements.dataEntitlements || [];
                    
                    const apps = smlServiceInstance.normalizeApps({ apps: appsRaw });
                    const models = smlServiceInstance.normalizeModels({ models: modelsRaw });
                    const data = smlServiceInstance.normalizeData({ data: dataRaw });
                    
                    const allProducts = [...apps, ...models, ...data];
                    const expiredProducts = allProducts.filter(p => p.status === 'expired');
                    
                    // Collect product names and categories
                    expiredProducts.forEach(product => {
                        expiredProductsList.push(product.productName || product.productCode);
                        if (product.category) {
                            productCategories.add(product.category);
                        }
                    });
                }
            }
            
            // Calculate days since expiry
            const latestExpiryDate = new Date(account.latest_expiry_date);
            const today = new Date();
            const daysSinceExpiry = Math.floor((today - latestExpiryDate) / (1000 * 60 * 60 * 24));
            
            // Add row
            worksheet.addRow({
                tenantId: account.tenant_id,
                tenantName: account.tenant_name,
                accountName: account.account_name || 'N/A',
                totalExpiredProducts: account.total_expired_products,
                latestExpiryDate: latestExpiryDate.toLocaleDateString(),
                daysSinceExpiry: daysSinceExpiry,
                reviewStatus: account.is_reviewed ? 'Reviewed' : 'Needs Review',
                reviewedAt: account.reviewed_at ? new Date(account.reviewed_at).toLocaleDateString() : '',
                reviewedBy: account.reviewed_by || '',
                expiredProducts: expiredProductsList.join(', '),
                productCategories: Array.from(productCategories).join(', ')
            });
        }
        
        // Auto-fit columns (approximate)
        worksheet.columns.forEach(column => {
            if (column.width < 15) {
                column.width = 15;
            }
        });
        
        // Add filters to header row
        worksheet.autoFilter = {
            from: 'A1',
            to: 'K1'
        };
        
        // Freeze header row
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1 }
        ];
        
        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Set response headers for download
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `SML_Ghost_Accounts_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
        console.log(`✅ Exported ${ghostAccounts.length} ghost accounts to Excel`);
        
    } catch (err) {
        console.error('❌ Error exporting ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export ghost accounts to Excel',
            details: err.message
        });
    }
});

/**
 * POST /api/sml-ghost-accounts/analyze
 * Run full SML ghost accounts analysis (fetches from SML API)
 */
router.post('/analyze', async (req, res) => {
    try {
        console.log('🔄 SML ghost accounts full analysis requested (will fetch from SML)...');
        
        // Check if SML is configured
        const config = smlServiceInstance.getConfig();
        if (!config || !config.authCookie) {
            return res.status(401).json({
                success: false,
                error: 'No SML authentication configured. Please configure SML in Settings.'
            });
        }
        
        const analysisStarted = new Date();
        
        console.log('👻 Starting SML ghost accounts identification (fetching from SML)...');
        
        const result = await smlGhostService.refreshGhostAccountsFromSML();
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            console.log(`✅ SML ghost accounts analysis complete: ${result.summary.ghostAccountsFound} ghost accounts found`);
            
            res.json({
                success: true,
                message: 'SML ghost accounts analysis completed successfully',
                summary: {
                    totalTenants: result.summary.totalTenants,
                    mappedTenants: result.summary.mappedTenants,
                    totalAnalyzed: result.summary.totalAnalyzed,
                    ghostAccountsFound: result.summary.ghostAccountsFound,
                    duration: durationSeconds
                },
                dataSource: 'sml',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'SML ghost accounts analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error refreshing SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh SML ghost accounts analysis',
            details: err.message
        });
    }
});

/**
 * POST /api/sml-ghost-accounts/refresh
 * Re-analyze SML ghost accounts from cached data (fast, no API calls)
 */
router.post('/refresh', async (req, res) => {
    try {
        console.log('🔄 SML ghost accounts refresh requested (using cached data)...');
        
        const analysisStarted = new Date();
        
        console.log('👻 Re-analyzing ghost accounts from cached data...');
        
        const result = await smlGhostService.reanalyzeFromCache();
        
        const analysisCompleted = new Date();
        const durationSeconds = (analysisCompleted - analysisStarted) / 1000;
        
        if (result.success) {
            console.log(`✅ SML ghost accounts re-analysis complete: ${result.summary.ghostAccountsFound} ghost accounts found`);
            
            res.json({
                success: true,
                message: 'SML ghost accounts re-analyzed from cached data',
                summary: {
                    totalAnalyzed: result.summary.totalAnalyzed,
                    ghostAccountsFound: result.summary.ghostAccountsFound,
                    duration: durationSeconds
                },
                dataSource: 'sml',
                fromCache: true,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                message: 'SML ghost accounts re-analysis failed'
            });
        }
    } catch (err) {
        console.error('❌ Error re-analyzing SML ghost accounts:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to re-analyze SML ghost accounts',
            details: err.message
        });
    }
});

/**
 * POST /api/sml-ghost-accounts/:tenantId/review
 * Mark SML ghost account as reviewed
 */
router.post('/:tenantId/review', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { reviewedBy, notes } = req.body;
        
        if (!reviewedBy) {
            return res.status(400).json({
                success: false,
                error: 'reviewedBy is required'
            });
        }
        
        console.log(`✅ Marking SML ghost account as reviewed: ${tenantId}`);
        
        const result = await db.markSMLGhostAccountReviewed(tenantId, reviewedBy, notes);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'SML ghost account marked as reviewed',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error marking SML ghost account as reviewed:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark SML ghost account as reviewed'
        });
    }
});

/**
 * GET /api/sml-ghost-accounts/:tenantId/products
 * Get expired products for a specific SML ghost account (from cached data)
 */
router.get('/:tenantId/products', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { category, excludeProduct, includeExpired } = req.query;
        
        console.log(`📦 Fetching cached products for SML ghost account: ${tenantId}`);
        
        // Get the tenant from database with cached product entitlements
        const tenantResult = await db.getSMLTenantById(tenantId);
        if (!tenantResult.success || !tenantResult.tenant) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }
        
        const tenant = tenantResult.tenant;
        
        // Parse product entitlements from cache
        const productEntitlements = typeof tenant.product_entitlements === 'string' 
            ? JSON.parse(tenant.product_entitlements)
            : tenant.product_entitlements;
        
        if (!productEntitlements) {
            return res.status(404).json({
                success: false,
                error: 'No cached product entitlements found for this tenant. Try running "Run Analysis" first.'
            });
        }
        
        // Normalize products using SML service (same as analysis logic)
        const appsRaw = productEntitlements.appEntitlements || [];
        const modelsRaw = productEntitlements.modelEntitlements || [];
        const dataRaw = productEntitlements.dataEntitlements || [];
        
        const apps = smlServiceInstance.normalizeApps({ apps: appsRaw });
        const models = smlServiceInstance.normalizeModels({ models: modelsRaw });
        const data = smlServiceInstance.normalizeData({ data: dataRaw });
        
        // Always return all products (includeExpired just means include expired in the list, not filter to only expired)
        let allProducts = [...apps, ...models, ...data];
        
        // Apply category filter if provided
        if (category) {
            allProducts = allProducts.filter(p => p.category === category);
        }
        
        // Apply product name exclusion if provided
        if (excludeProduct) {
            const excludeLower = excludeProduct.toLowerCase();
            allProducts = allProducts.filter(p => 
                !p.productCode?.toLowerCase().includes(excludeLower) &&
                !p.productName?.toLowerCase().includes(excludeLower)
            );
        }
        
        // Categorize products for the frontend
        const categorizedProducts = allProducts.map(product => ({
            ...product,
            // Ensure category field is set properly for frontend
            category: product.category || 
                (apps.includes(product) ? 'apps' : models.includes(product) ? 'models' : 'data')
        }));
        
        const summary = {
            total: allProducts.length,
            byCategory: {
                apps: allProducts.filter(p => p.category === 'apps').length,
                models: allProducts.filter(p => p.category === 'models').length,
                data: allProducts.filter(p => p.category === 'data').length
            },
            byStatus: {
                active: allProducts.filter(p => p.status === 'active').length,
                expired: allProducts.filter(p => p.status === 'expired').length
            }
        };
        
        res.json({
            success: true,
            tenantId: tenantId,
            tenantName: tenant.tenant_name,
            accountName: tenant.account_name,
            products: categorizedProducts,
            summary: summary,
            dataSource: 'sml',
            fromCache: true,
            lastSynced: tenant.last_synced,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Error fetching SML ghost account products:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch SML ghost account products',
            details: err.message
        });
    }
});

/**
 * DELETE /api/sml-ghost-accounts/:tenantId
 * Remove SML ghost account from tracking
 */
router.delete('/:tenantId', async (req, res) => {
    try {
        const { tenantId } = req.params;
        
        console.log(`🗑️ Removing SML ghost account: ${tenantId}`);
        
        const result = await db.removeSMLGhostAccount(tenantId);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'SML ghost account removed from tracking',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (err) {
        console.error('❌ Error removing SML ghost account:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove SML ghost account'
        });
    }
});

module.exports = router;

