/**
 * Middleware to check if bundle columns exist
 * Prevents 500 errors when columns haven't been added yet
 */

const db = require('../database');
const logger = require('../utils/logger');

let bundleColumnsExist = null;
let lastCheck = null;
const CHECK_INTERVAL = 60000; // Check every 60 seconds

/**
 * Check if bundle columns exist in products table
 */
async function checkBundleColumns() {
    const now = Date.now();
    
    // Use cached result if checked recently
    if (bundleColumnsExist !== null && lastCheck && (now - lastCheck) < CHECK_INTERVAL) {
        return bundleColumnsExist;
    }
    
    try {
        const result = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('is_bundle', 'constituents')
        `);
        
        bundleColumnsExist = result.rows.length === 2;
        lastCheck = now;
        
        if (!bundleColumnsExist) {
            logger.warn('Bundle columns (is_bundle, constituents) do not exist yet. Run migration: node scripts/database/run-bundle-constituents-migration.js');
        }
        
        return bundleColumnsExist;
    } catch (error) {
        logger.error('Error checking bundle columns:', error.message);
        bundleColumnsExist = false;
        lastCheck = now;
        return false;
    }
}

/**
 * Express middleware to check bundle columns before handling request
 * Returns 503 if columns don't exist for bundle-specific endpoints
 */
async function requireBundleColumns(req, res, next) {
    const exists = await checkBundleColumns();
    
    if (!exists) {
        return res.status(503).json({
            success: false,
            error: 'Bundle feature not yet initialized',
            message: 'Please run the database migration: node scripts/database/run-bundle-constituents-migration.js',
            hint: 'The is_bundle and constituents columns need to be added to the products table.'
        });
    }
    
    next();
}

module.exports = {
    checkBundleColumns,
    requireBundleColumns
};

