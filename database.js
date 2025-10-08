// PostgreSQL Database Connection Module
const { Pool } = require('pg');

// Database configuration from environment or defaults
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    // Connection pool settings
    max: parseInt(process.env.DB_POOL_MAX || '10'), // Maximum connections in pool
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // 2 seconds
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
});

// Log successful connection (only once at startup)
pool.on('connect', () => {
    if (!pool._hasConnected) {
        console.log('✅ PostgreSQL connection pool established');
        pool._hasConnected = true;
    }
});

/**
 * Execute a query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`📊 Query executed in ${duration}ms - Rows: ${result.rowCount}`);
        return result;
    } catch (error) {
        console.error('❌ Database query error:', error.message);
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
    const client = await pool.connect();
    const originalRelease = client.release.bind(client);
    
    // Enhance release to handle errors
    client.release = () => {
        client.release = originalRelease;
        return originalRelease();
    };
    
    return client;
}

/**
 * Test database connection
 * @returns {Promise<Object>} Connection status
 */
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW() as current_time, current_database() as database, current_user as user');
        return {
            success: true,
            connected: true,
            timestamp: result.rows[0].current_time,
            database: result.rows[0].database,
            user: result.rows[0].user
        };
    } catch (error) {
        return {
            success: false,
            connected: false,
            error: error.message
        };
    }
}

/**
 * Close all connections in the pool
 * @returns {Promise<void>}
 */
async function closePool() {
    try {
        await pool.end();
        console.log('✅ PostgreSQL connection pool closed');
    } catch (error) {
        console.error('❌ Error closing PostgreSQL pool:', error.message);
        throw error;
    }
}

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback function
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
    const client = await getClient();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get pool statistics
 * @returns {Object} Pool stats
 */
function getPoolStats() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    };
}

// ===== EXPIRATION MONITOR DATABASE FUNCTIONS =====

/**
 * Clear expiration monitor cache
 * @returns {Promise<Object>} Result
 */
async function clearExpirationCache() {
    try {
        const result = await pool.query('DELETE FROM expiration_monitor');
        console.log(`🗑️ Cleared ${result.rowCount} rows from expiration_monitor cache`);
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error('❌ Error clearing expiration cache:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Insert expiration data (bulk)
 * @param {Array} expirationData - Array of expiration objects
 * @returns {Promise<Object>} Result
 */
async function insertExpirationData(expirationData) {
    if (!expirationData || expirationData.length === 0) {
        return { success: true, insertedCount: 0 };
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const insertPromises = expirationData.map(item => {
            const query = `
                INSERT INTO expiration_monitor (
                    account_id, account_name, ps_record_id, ps_record_name,
                    product_code, product_name, product_type, end_date,
                    is_extended, extending_ps_record_id, extending_ps_record_name,
                    extending_end_date, days_until_expiry, last_analyzed
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `;
            const values = [
                item.accountId,
                item.accountName,
                item.psRecordId,
                item.psRecordName,
                item.productCode,
                item.productName,
                item.productType,
                item.endDate,
                item.isExtended || false,
                item.extendingPsRecordId || null,
                item.extendingPsRecordName || null,
                item.extendingEndDate || null,
                item.daysUntilExpiry,
                new Date()
            ];
            return client.query(query, values);
        });

        await Promise.all(insertPromises);
        await client.query('COMMIT');

        console.log(`✅ Inserted ${expirationData.length} expiration records into cache`);
        return { success: true, insertedCount: expirationData.length };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error inserting expiration data:', error.message);
        return { success: false, error: error.message };
    } finally {
        client.release();
    }
}

/**
 * Get expiration data with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Query result
 */
async function getExpirationData(filters = {}) {
    try {
        let queryText = `
            SELECT 
                account_id, account_name, ps_record_id, ps_record_name,
                product_code, product_name, product_type, end_date,
                is_extended, extending_ps_record_id, extending_ps_record_name,
                extending_end_date, days_until_expiry, last_analyzed
            FROM expiration_monitor
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Filter by expiration window (days)
        if (filters.expirationWindow) {
            queryText += ` AND days_until_expiry <= $${paramCount}`;
            params.push(filters.expirationWindow);
            paramCount++;
        }

        // Filter by extended status
        if (filters.showExtended === false) {
            queryText += ` AND is_extended = false`;
        }

        // Filter by account
        if (filters.accountId) {
            queryText += ` AND account_id = $${paramCount}`;
            params.push(filters.accountId);
            paramCount++;
        }

        // Filter by product type
        if (filters.productType) {
            queryText += ` AND product_type = $${paramCount}`;
            params.push(filters.productType);
            paramCount++;
        }

        queryText += ' ORDER BY days_until_expiry ASC, account_name ASC, ps_record_name ASC';

        const result = await pool.query(queryText, params);
        return { success: true, data: result.rows, count: result.rowCount };
    } catch (error) {
        console.error('❌ Error getting expiration data:', error.message);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Get aggregated expiration summary
 * @param {number} expirationWindow - Days until expiry
 * @returns {Promise<Object>} Summary data
 */
async function getExpirationSummary(expirationWindow = 30) {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_expiring,
                COUNT(*) FILTER (WHERE is_extended = false) as at_risk,
                COUNT(*) FILTER (WHERE is_extended = true) as extended,
                COUNT(DISTINCT account_id) as accounts_affected,
                COUNT(DISTINCT ps_record_id) as ps_records_affected,
                MIN(end_date) as earliest_expiry,
                MAX(end_date) as latest_expiry
            FROM expiration_monitor
            WHERE days_until_expiry <= $1
        `;
        
        const result = await pool.query(query, [expirationWindow]);
        return { success: true, summary: result.rows[0] };
    } catch (error) {
        console.error('❌ Error getting expiration summary:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Log expiration analysis run
 * @param {Object} logData - Analysis log data
 * @returns {Promise<Object>} Result
 */
async function logExpirationAnalysis(logData) {
    try {
        const query = `
            INSERT INTO expiration_analysis_log (
                analysis_started, analysis_completed, records_analyzed,
                entitlements_processed, expirations_found, extensions_found,
                lookback_years, status, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        
        const values = [
            logData.analysisStarted,
            logData.analysisCompleted,
            logData.recordsAnalyzed || 0,
            logData.entitlementsProcessed || 0,
            logData.expirationsFound || 0,
            logData.extensionsFound || 0,
            logData.lookbackYears || 5,
            logData.status || 'completed',
            logData.errorMessage || null
        ];
        
        const result = await pool.query(query, values);
        console.log(`📝 Logged expiration analysis run (ID: ${result.rows[0].id})`);
        return { success: true, logId: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error logging expiration analysis:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get latest expiration analysis status
 * @returns {Promise<Object>} Latest analysis log
 */
async function getLatestAnalysisStatus() {
    try {
        const query = `
            SELECT * FROM expiration_analysis_log
            WHERE status != 'schema_initialized'
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query);
        if (result.rowCount === 0) {
            return { success: true, hasAnalysis: false };
        }
        
        return { success: true, hasAnalysis: true, analysis: result.rows[0] };
    } catch (error) {
        console.error('❌ Error getting latest analysis status:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== ALL ACCOUNTS DATABASE FUNCTIONS =====

/**
 * Upsert (insert or update) an account in the all_accounts table
 */
async function upsertAllAccount(accountData) {
    try {
        const query = `
            INSERT INTO all_accounts (account_id, account_name, total_ps_records, latest_ps_date, last_synced, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (account_id) 
            DO UPDATE SET
                account_name = EXCLUDED.account_name,
                total_ps_records = EXCLUDED.total_ps_records,
                latest_ps_date = EXCLUDED.latest_ps_date,
                last_synced = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            accountData.accountId,
            accountData.accountName,
            accountData.totalPsRecords || 0,
            accountData.latestPsDate || null
        ];
        
        const result = await pool.query(query, values);
        return { success: true, account: result.rows[0] };
    } catch (error) {
        console.error('❌ Error upserting account:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all accounts from the all_accounts table
 */
async function getAllAccounts(filters = {}) {
    try {
        let query = `SELECT * FROM all_accounts WHERE 1=1`;
        const values = [];
        let paramCount = 1;
        
        // Add search filter
        if (filters.search) {
            query += ` AND account_name ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }
        
        query += ` ORDER BY account_name ASC`;
        
        const result = await pool.query(query, values);
        return { success: true, accounts: result.rows, count: result.rows.length };
    } catch (error) {
        console.error('❌ Error fetching all accounts:', error.message);
        return { success: false, error: error.message, accounts: [], count: 0 };
    }
}

/**
 * Get summary statistics for all accounts
 */
async function getAllAccountsSummary() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_accounts,
                MAX(last_synced) as last_sync_time
            FROM all_accounts
        `;
        
        const result = await pool.query(query);
        return { success: true, summary: result.rows[0] };
    } catch (error) {
        console.error('❌ Error fetching all accounts summary:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== GHOST ACCOUNTS DATABASE FUNCTIONS =====

/**
 * Get all unique accounts from expiration monitor
 * @returns {Promise<Object>} List of unique accounts
 */
async function getUniqueAccountsFromExpiration() {
    try {
        const query = `
            SELECT DISTINCT account_id, account_name
            FROM expiration_monitor
            ORDER BY account_name ASC
        `;
        
        const result = await pool.query(query);
        return { success: true, accounts: result.rows };
    } catch (error) {
        console.error('❌ Error getting unique accounts:', error.message);
        return { success: false, error: error.message, accounts: [] };
    }
}

/**
 * Upsert ghost account data
 * @param {Object} ghostAccountData - Ghost account information
 * @returns {Promise<Object>} Result
 */
async function upsertGhostAccount(ghostAccountData) {
    try {
        const query = `
            INSERT INTO ghost_accounts (
                account_id, account_name, total_expired_products, 
                latest_expiry_date, last_checked, updated_at
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (account_id) 
            DO UPDATE SET
                account_name = EXCLUDED.account_name,
                total_expired_products = EXCLUDED.total_expired_products,
                latest_expiry_date = EXCLUDED.latest_expiry_date,
                last_checked = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `;
        
        const values = [
            ghostAccountData.accountId,
            ghostAccountData.accountName,
            ghostAccountData.totalExpiredProducts,
            ghostAccountData.latestExpiryDate
        ];
        
        const result = await pool.query(query, values);
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error upserting ghost account:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all ghost accounts with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} List of ghost accounts
 */
async function getGhostAccounts(filters = {}) {
    try {
        let queryText = `
            SELECT 
                id, account_id, account_name, total_expired_products,
                latest_expiry_date, last_checked, is_reviewed,
                reviewed_at, reviewed_by, notes, created_at, updated_at
            FROM ghost_accounts
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        // Filter by reviewed status
        if (filters.isReviewed !== undefined) {
            queryText += ` AND is_reviewed = $${paramCount}`;
            params.push(filters.isReviewed);
            paramCount++;
        }

        // Filter by account name search
        if (filters.accountSearch) {
            queryText += ` AND account_name ILIKE $${paramCount}`;
            params.push(`%${filters.accountSearch}%`);
            paramCount++;
        }

        // Filter by expiry date range
        if (filters.expiryBefore) {
            queryText += ` AND latest_expiry_date <= $${paramCount}`;
            params.push(filters.expiryBefore);
            paramCount++;
        }

        if (filters.expiryAfter) {
            queryText += ` AND latest_expiry_date >= $${paramCount}`;
            params.push(filters.expiryAfter);
            paramCount++;
        }

        queryText += ' ORDER BY latest_expiry_date DESC, account_name ASC';

        const result = await pool.query(queryText, params);
        return { success: true, ghostAccounts: result.rows, count: result.rowCount };
    } catch (error) {
        console.error('❌ Error getting ghost accounts:', error.message);
        return { success: false, error: error.message, ghostAccounts: [] };
    }
}

/**
 * Mark ghost account as reviewed
 * @param {string} accountId - Account ID
 * @param {string} reviewedBy - Username/email of reviewer
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Result
 */
async function markGhostAccountReviewed(accountId, reviewedBy, notes = null) {
    try {
        const query = `
            UPDATE ghost_accounts
            SET 
                is_reviewed = TRUE,
                reviewed_at = CURRENT_TIMESTAMP,
                reviewed_by = $2,
                notes = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE account_id = $1
            RETURNING id
        `;
        
        const values = [accountId, reviewedBy, notes];
        const result = await pool.query(query, values);
        
        if (result.rowCount === 0) {
            return { success: false, error: 'Account not found' };
        }
        
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error marking ghost account as reviewed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Remove ghost account from tracking (e.g., if it's been deprovisioned)
 * @param {string} accountId - Account ID
 * @returns {Promise<Object>} Result
 */
async function removeGhostAccount(accountId) {
    try {
        const query = `DELETE FROM ghost_accounts WHERE account_id = $1`;
        const result = await pool.query(query, [accountId]);
        
        return { success: true, deleted: result.rowCount > 0 };
    } catch (error) {
        console.error('❌ Error removing ghost account:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Clear all ghost accounts (for refresh)
 * @returns {Promise<Object>} Result
 */
async function clearGhostAccounts() {
    try {
        const result = await pool.query('DELETE FROM ghost_accounts');
        console.log(`🗑️ Cleared ${result.rowCount} ghost accounts from cache`);
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error('❌ Error clearing ghost accounts:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get ghost accounts summary statistics
 * @returns {Promise<Object>} Summary data
 */
async function getGhostAccountsSummary() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_ghost_accounts,
                COUNT(*) FILTER (WHERE is_reviewed = false) as unreviewed,
                COUNT(*) FILTER (WHERE is_reviewed = true) as reviewed,
                MIN(latest_expiry_date) as earliest_expiry,
                MAX(latest_expiry_date) as most_recent_expiry,
                SUM(total_expired_products) as total_expired_products
            FROM ghost_accounts
        `;
        
        const result = await pool.query(query);
        return { success: true, summary: result.rows[0] };
    } catch (error) {
        console.error('❌ Error getting ghost accounts summary:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== PACKAGE FUNCTIONS =====

/**
 * Upsert a package (insert or update if exists)
 */
async function upsertPackage(packageData) {
    const query = `
        INSERT INTO packages (
            sf_package_id, package_name, ri_package_name, package_type, parent_package_id,
            locations, max_concurrent_model, max_concurrent_non_model,
            max_concurrent_accumulation_jobs, max_concurrent_non_accumulation_jobs,
            max_jobs_day, max_users, number_edms,
            max_exposure_storage_tb, max_other_storage_tb,
            max_risks_accumulated_day, max_risks_single_accumulation,
            api_rps, description,
            sf_owner_id, sf_created_by_id, sf_last_modified_by_id, is_deleted,
            metadata, last_synced
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP
        )
        ON CONFLICT (sf_package_id) DO UPDATE SET
            package_name = EXCLUDED.package_name,
            ri_package_name = EXCLUDED.ri_package_name,
            package_type = EXCLUDED.package_type,
            parent_package_id = EXCLUDED.parent_package_id,
            locations = EXCLUDED.locations,
            max_concurrent_model = EXCLUDED.max_concurrent_model,
            max_concurrent_non_model = EXCLUDED.max_concurrent_non_model,
            max_concurrent_accumulation_jobs = EXCLUDED.max_concurrent_accumulation_jobs,
            max_concurrent_non_accumulation_jobs = EXCLUDED.max_concurrent_non_accumulation_jobs,
            max_jobs_day = EXCLUDED.max_jobs_day,
            max_users = EXCLUDED.max_users,
            number_edms = EXCLUDED.number_edms,
            max_exposure_storage_tb = EXCLUDED.max_exposure_storage_tb,
            max_other_storage_tb = EXCLUDED.max_other_storage_tb,
            max_risks_accumulated_day = EXCLUDED.max_risks_accumulated_day,
            max_risks_single_accumulation = EXCLUDED.max_risks_single_accumulation,
            api_rps = EXCLUDED.api_rps,
            description = EXCLUDED.description,
            sf_owner_id = EXCLUDED.sf_owner_id,
            sf_created_by_id = EXCLUDED.sf_created_by_id,
            sf_last_modified_by_id = EXCLUDED.sf_last_modified_by_id,
            is_deleted = EXCLUDED.is_deleted,
            metadata = EXCLUDED.metadata,
            last_synced = CURRENT_TIMESTAMP
        RETURNING *;
    `;
    
    const values = [
        packageData.sf_package_id,
        packageData.package_name,
        packageData.ri_package_name || null,
        packageData.package_type || null,
        packageData.parent_package_id || null,
        packageData.locations || null,
        packageData.max_concurrent_model || null,
        packageData.max_concurrent_non_model || null,
        packageData.max_concurrent_accumulation_jobs || null,
        packageData.max_concurrent_non_accumulation_jobs || null,
        packageData.max_jobs_day || null,
        packageData.max_users || null,
        packageData.number_edms || null,
        packageData.max_exposure_storage_tb || null,
        packageData.max_other_storage_tb || null,
        packageData.max_risks_accumulated_day || null,
        packageData.max_risks_single_accumulation || null,
        packageData.api_rps || null,
        packageData.description || null,
        packageData.sf_owner_id || null,
        packageData.sf_created_by_id || null,
        packageData.sf_last_modified_by_id || null,
        packageData.is_deleted || false,
        packageData.metadata ? JSON.stringify(packageData.metadata) : null
    ];
    
    try {
        const result = await pool.query(query, values);
        return {
            success: true,
            package: result.rows[0]
        };
    } catch (error) {
        console.error('Error upserting package:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get a package by internal database ID
 */
async function getPackageById(id) {
    const query = 'SELECT * FROM packages WHERE id = $1';
    
    try {
        const result = await pool.query(query, [id]);
        return {
            success: true,
            package: result.rows[0] || null
        };
    } catch (error) {
        console.error('Error getting package by ID:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get a package by Salesforce ID
 */
async function getPackageBySfId(sfPackageId) {
    const query = 'SELECT * FROM packages WHERE sf_package_id = $1';
    
    try {
        const result = await pool.query(query, [sfPackageId]);
        return {
            success: true,
            package: result.rows[0] || null
        };
    } catch (error) {
        console.error('Error getting package by SF ID:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get a package by name (either package_name or ri_package_name)
 */
async function getPackageByName(name) {
    const query = `
        SELECT * FROM packages 
        WHERE package_name ILIKE $1 OR ri_package_name ILIKE $1
        AND is_deleted = FALSE
        ORDER BY last_synced DESC
        LIMIT 1
    `;
    
    try {
        const result = await pool.query(query, [name]);
        return {
            success: true,
            package: result.rows[0] || null
        };
    } catch (error) {
        console.error('Error getting package by name:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get all packages (optionally filter by active/deleted)
 */
async function getAllPackages(options = {}) {
    const { includeDeleted = false, sortBy = 'package_name', sortOrder = 'ASC' } = options;
    
    let query = 'SELECT * FROM packages';
    const params = [];
    
    if (!includeDeleted) {
        query += ' WHERE is_deleted = FALSE';
    }
    
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    try {
        const result = await pool.query(query, params);
        return {
            success: true,
            packages: result.rows,
            count: result.rows.length
        };
    } catch (error) {
        console.error('Error getting all packages:', error);
        return {
            success: false,
            error: error.message,
            packages: []
        };
    }
}

/**
 * Get base packages only
 */
async function getBasePackages() {
    const query = `
        SELECT * FROM packages 
        WHERE package_type = 'Base' AND is_deleted = FALSE
        ORDER BY locations ASC NULLS LAST, package_name ASC
    `;
    
    try {
        const result = await pool.query(query);
        return {
            success: true,
            packages: result.rows,
            count: result.rows.length
        };
    } catch (error) {
        console.error('Error getting base packages:', error);
        return {
            success: false,
            error: error.message,
            packages: []
        };
    }
}

/**
 * Get expansion packages only
 */
async function getExpansionPackages() {
    const query = `
        SELECT * FROM packages 
        WHERE package_type = 'Expansion' AND is_deleted = FALSE
        ORDER BY locations ASC NULLS LAST, package_name ASC
    `;
    
    try {
        const result = await pool.query(query);
        return {
            success: true,
            packages: result.rows,
            count: result.rows.length
        };
    } catch (error) {
        console.error('Error getting expansion packages:', error);
        return {
            success: false,
            error: error.message,
            packages: []
        };
    }
}

/**
 * Get packages summary statistics
 */
async function getPackagesSummary() {
    const query = `
        SELECT 
            COUNT(*) as total_packages,
            COUNT(*) FILTER (WHERE is_deleted = FALSE) as active_packages,
            COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_packages,
            COUNT(*) FILTER (WHERE package_type = 'Base' AND is_deleted = FALSE) as base_packages,
            COUNT(*) FILTER (WHERE package_type = 'Expansion' AND is_deleted = FALSE) as expansion_packages,
            MAX(last_synced) as last_sync_time
        FROM packages
    `;
    
    try {
        const result = await pool.query(query);
        return {
            success: true,
            summary: result.rows[0]
        };
    } catch (error) {
        console.error('Error getting packages summary:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Clear all packages (for re-sync)
 */
async function clearPackages() {
    const query = 'DELETE FROM packages';
    
    try {
        const result = await pool.query(query);
        return {
            success: true,
            deleted: result.rowCount
        };
    } catch (error) {
        console.error('Error clearing packages:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    query,
    getClient,
    testConnection,
    closePool,
    transaction,
    getPoolStats,
    pool, // Export pool for advanced usage
    // Expiration monitor functions
    clearExpirationCache,
    insertExpirationData,
    getExpirationData,
    getExpirationSummary,
    logExpirationAnalysis,
    getLatestAnalysisStatus,
    // All accounts functions
    upsertAllAccount,
    getAllAccounts,
    getAllAccountsSummary,
    // Ghost accounts functions
    getUniqueAccountsFromExpiration,
    upsertGhostAccount,
    getGhostAccounts,
    markGhostAccountReviewed,
    removeGhostAccount,
    clearGhostAccounts,
    getGhostAccountsSummary,
    // Package functions
    upsertPackage,
    getPackageById,
    getPackageBySfId,
    getPackageByName,
    getAllPackages,
    getBasePackages,
    getExpansionPackages,
    getPackagesSummary,
    clearPackages
};
