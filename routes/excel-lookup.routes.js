/**
 * Excel Lookup Routes
 * API endpoints for Excel-based tenant lookup feature
 * 
 * This module provides endpoints for:
 * - VBA macros to call from Excel
 * - Testing VBA connectivity
 * - Tenant entitlement lookups
 * - PS record vs SML comparisons
 */

const express = require('express');
const router = express.Router();
const excelLookupService = require('../services/excel-lookup.service');

/**
 * GET /api/excel-lookup/test
 * Simple test endpoint to verify VBA connectivity
 * No authentication required for testing
 */
router.get('/test', (req, res) => {
    console.log('📡 GET /api/excel-lookup/test - VBA connectivity test');
    
    res.json({
        success: true,
        message: 'VBA connectivity test successful!',
        timestamp: new Date().toISOString(),
        server: 'Deploy Assist API',
        version: '1.0.0',
        capabilities: {
            tenantLookup: true,
            psRecordComparison: true,
            excelIntegration: true
        }
    });
});

/**
 * POST /api/excel-lookup/test
 * Test endpoint for POST requests with JSON body
 * Echoes back what was received to verify JSON parsing
 */
router.post('/test', (req, res) => {
    console.log('📡 POST /api/excel-lookup/test - VBA POST test');
    console.log('   Request body:', JSON.stringify(req.body, null, 2));
    
    res.json({
        success: true,
        message: 'VBA POST test successful!',
        timestamp: new Date().toISOString(),
        received: req.body,
        echo: {
            test: req.body.test,
            source: req.body.source,
            receivedAt: new Date().toISOString()
        }
    });
});

/**
 * POST /api/excel-lookup/tenant
 * Look up a tenant by name or ID and return SML entitlements
 * 
 * Request body:
 * {
 *   "tenantNameOrId": "acme-corp" | "tenant-uuid"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "tenant": { tenantId, tenantName, accountName },
 *   "entitlements": {
 *     "models": [...],
 *     "data": [...],
 *     "apps": [...]
 *   },
 *   "summary": { totalCount, modelsCount, dataCount, appsCount }
 * }
 */
router.post('/tenant', async (req, res) => {
    try {
        console.log('📡 POST /api/excel-lookup/tenant');
        const { tenantNameOrId } = req.body;
        
        if (!tenantNameOrId) {
            return res.status(400).json({
                success: false,
                error: 'tenantNameOrId is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`   Looking up tenant: ${tenantNameOrId}`);
        
        const result = await excelLookupService.lookupTenant(tenantNameOrId);
        
        if (!result.success) {
            return res.status(404).json({
                ...result,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in POST /api/excel-lookup/tenant:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/excel-lookup/compare
 * Look up a tenant and compare with a PS record
 * 
 * Request body:
 * {
 *   "tenantNameOrId": "acme-corp",
 *   "psRecordName": "PS-12345" (optional - if not provided, just returns SML entitlements)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "tenant": { ... },
 *   "smlEntitlements": { models, data, apps },
 *   "psEntitlements": { models, data, apps } (if PS record provided),
 *   "comparison": {
 *     "models": { inSFOnly, inSMLOnly, different, matching },
 *     "data": { inSFOnly, inSMLOnly, different, matching },
 *     "apps": { inSFOnly, inSMLOnly, different, matching }
 *   },
 *   "summary": {
 *     "hasDiscrepancies": true/false,
 *     "inSFOnly": 3,      // Green - adding entitlements
 *     "inSMLOnly": 1,     // Red - removing entitlements  
 *     "different": 2,     // Yellow - attribute differences
 *     "matching": 20      // Blue - perfect matches
 *   }
 * }
 */
router.post('/compare', async (req, res) => {
    try {
        console.log('📡 POST /api/excel-lookup/compare');
        const { tenantNameOrId, psRecordName } = req.body;
        
        if (!tenantNameOrId) {
            return res.status(400).json({
                success: false,
                error: 'tenantNameOrId is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`   Tenant: ${tenantNameOrId}`);
        console.log(`   PS Record: ${psRecordName || '(none - SML lookup only)'}`);
        
        let result;
        
        if (psRecordName) {
            // Compare with PS record
            result = await excelLookupService.compareWithPSRecord(tenantNameOrId, psRecordName);
        } else {
            // Just lookup tenant SML entitlements
            result = await excelLookupService.lookupTenant(tenantNameOrId);
        }
        
        if (!result.success) {
            const statusCode = result.error?.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                ...result,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in POST /api/excel-lookup/compare:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/excel-lookup/compare-excel
 * Same as /compare but formats output for easy Excel writing
 * Returns flat arrays suitable for VBA to write directly to Excel rows
 */
router.post('/compare-excel', async (req, res) => {
    try {
        console.log('📡 POST /api/excel-lookup/compare-excel');
        const { tenantNameOrId, psRecordName, forceFresh } = req.body;
        
        if (!tenantNameOrId) {
            return res.status(400).json({
                success: false,
                error: 'tenantNameOrId is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`   Tenant: ${tenantNameOrId}`);
        console.log(`   PS Record: ${psRecordName || '(none)'}`);
        console.log(`   Force Fresh: ${forceFresh ? 'Yes' : 'No'}`);
        
        let result;
        
        if (psRecordName) {
            result = await excelLookupService.compareWithPSRecord(tenantNameOrId, psRecordName, forceFresh);
            console.log('   Compare result success:', result.success);
            console.log('   Compare result has smlEntitlements:', !!result.smlEntitlements);
            console.log('   Compare result has comparison:', !!result.comparison);
            if (result.smlEntitlements) {
                console.log('   SML entitlements counts:', {
                    models: result.smlEntitlements.models?.length || 0,
                    data: result.smlEntitlements.data?.length || 0,
                    apps: result.smlEntitlements.apps?.length || 0
                });
            }
            if (!result.success) {
                console.log('   Compare error:', result.error);
            }
        } else {
            result = await excelLookupService.lookupTenant(tenantNameOrId, forceFresh);
        }
        
        // Format for Excel
        const excelFormatted = excelLookupService.formatForExcel(result);
        
        console.log('   Excel formatted result:', {
            success: excelFormatted.success,
            smlEntitlementsCount: excelFormatted.smlEntitlements?.length || 0,
            comparisonCount: excelFormatted.comparison?.length || 0
        });
        
        res.json({
            ...excelFormatted,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in POST /api/excel-lookup/compare-excel:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/excel-lookup/search-ps-records
 * Search for PS records by name, account, or tenant
 * Useful for finding the correct PS record name
 */
router.post('/search-ps-records', async (req, res) => {
    try {
        console.log('📡 POST /api/excel-lookup/search-ps-records');
        const { searchTerm } = req.body;
        
        if (!searchTerm) {
            return res.status(400).json({
                success: false,
                error: 'searchTerm is required',
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`   Searching for PS records matching: ${searchTerm}`);
        
        const database = require('../database');
        const query = `
            SELECT DISTINCT ps_record_name, account_name, tenant_name, status, 
                   MAX(captured_at) as last_captured
            FROM ps_audit_trail
            WHERE ps_record_name ILIKE $1
               OR account_name ILIKE $1
               OR tenant_name ILIKE $1
            GROUP BY ps_record_name, account_name, tenant_name, status
            ORDER BY MAX(captured_at) DESC
            LIMIT 20
        `;
        
        const result = await database.query(query, [`%${searchTerm}%`]);
        
        console.log(`   Found ${result.rows.length} PS records`);
        
        res.json({
            success: true,
            searchTerm: searchTerm,
            count: result.rows.length,
            records: result.rows,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in POST /api/excel-lookup/search-ps-records:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
