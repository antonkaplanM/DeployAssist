// PostgreSQL Database Connection Module
const { Pool } = require('pg');

// Database configuration from environment or defaults
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'deployment_assistant',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD, // Required - set in .env file
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

        // Conditionally filter extended items based on showExtended parameter
        // If showExtended is false or not provided, only show non-extended items
        if (filters.showExtended === false || filters.showExtended === undefined) {
            queryText += ` AND is_extended = false`;
        }
        // If showExtended is true, show all items (no filter)

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
 * Get a single account by account_id
 */
async function getAccount(accountId) {
    try {
        const query = `SELECT * FROM all_accounts WHERE account_id = $1`;
        const result = await pool.query(query, [accountId]);
        
        if (result.rows.length === 0) {
            return { success: false, error: 'Account not found', account: null };
        }
        
        return { success: true, account: result.rows[0] };
    } catch (error) {
        console.error('❌ Error fetching account:', error.message);
        return { success: false, error: error.message, account: null };
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

// ===== PACKAGE CHANGE ANALYSIS FUNCTIONS =====

/**
 * Clear package change cache
 * @returns {Promise<Object>} Result
 */
async function clearPackageChangeCache() {
    try {
        const result = await pool.query('DELETE FROM package_change_analysis');
        console.log(`🗑️ Cleared ${result.rowCount} rows from package_change_analysis cache`);
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error('❌ Error clearing package change cache:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Insert package change data (bulk)
 * @param {Array} packageChangeData - Array of package change objects
 * @returns {Promise<Object>} Result
 */
async function insertPackageChangeData(packageChangeData) {
    if (!packageChangeData || packageChangeData.length === 0) {
        return { success: true, insertedCount: 0 };
    }

    const client = await getClient();
    try {
        await client.query('BEGIN');

        const insertPromises = packageChangeData.map(item => {
            const query = `
                INSERT INTO package_change_analysis (
                    analysis_date, ps_record_id, ps_record_name,
                    previous_ps_record_id, previous_ps_record_name,
                    deployment_number, tenant_name, account_id, account_name, account_site,
                    product_code, product_name, previous_package, new_package,
                    change_type, previous_start_date, previous_end_date,
                    new_start_date, new_end_date, ps_created_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            `;
            const values = [
                item.analysisDate || new Date(),
                item.psRecordId,
                item.psRecordName,
                item.previousPsRecordId,
                item.previousPsRecordName,
                item.deploymentNumber,
                item.tenantName || null,
                item.accountId || null,
                item.accountName,
                item.accountSite || null,
                item.productCode,
                item.productName || null,
                item.previousPackage,
                item.newPackage,
                item.changeType, // 'upgrade' or 'downgrade'
                item.previousStartDate || null,
                item.previousEndDate || null,
                item.newStartDate || null,
                item.newEndDate || null,
                item.psCreatedDate || null
            ];
            return client.query(query, values);
        });

        await Promise.all(insertPromises);
        await client.query('COMMIT');

        console.log(`✅ Inserted ${packageChangeData.length} package change records into cache`);
        return { success: true, insertedCount: packageChangeData.length };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error inserting package change data:', error.message);
        return { success: false, error: error.message };
    } finally {
        client.release();
    }
}

/**
 * Log package change analysis run
 * @param {Object} logData - Analysis log data
 * @returns {Promise<Object>} Result
 */
async function logPackageChangeAnalysis(logData) {
    try {
        const query = `
            INSERT INTO package_change_analysis_log (
                analysis_started, analysis_completed, records_analyzed,
                deployments_processed, changes_found, upgrades_found,
                downgrades_found, ps_records_with_changes, accounts_affected,
                lookback_years, start_date, end_date, status, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
        `;
        
        const values = [
            logData.analysisStarted,
            logData.analysisCompleted,
            logData.recordsAnalyzed || 0,
            logData.deploymentsProcessed || 0,
            logData.changesFound || 0,
            logData.upgradesFound || 0,
            logData.downgradesFound || 0,
            logData.psRecordsWithChanges || 0,
            logData.accountsAffected || 0,
            logData.lookbackYears || 2,
            logData.startDate || null,
            logData.endDate || null,
            logData.status || 'completed',
            logData.errorMessage || null
        ];
        
        const result = await pool.query(query, values);
        console.log(`📝 Logged package change analysis run (ID: ${result.rows[0].id})`);
        return { success: true, logId: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error logging package change analysis:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get latest package change analysis status
 * @returns {Promise<Object>} Latest analysis log
 */
async function getLatestPackageChangeAnalysisStatus() {
    try {
        const query = `
            SELECT * FROM package_change_analysis_log
            WHERE status != 'schema_initialized'
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return {
                success: true,
                hasAnalysis: false
            };
        }
        
        return {
            success: true,
            hasAnalysis: true,
            analysis: result.rows[0]
        };
    } catch (error) {
        console.error('❌ Error getting latest package change analysis status:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get package change summary statistics
 * @param {string} timeFrame - Time frame filter (30d, 90d, 6m, 1y, 2y)
 * @returns {Promise<Object>} Summary data
 */
async function getPackageChangeSummary(timeFrame = '1y') {
    try {
        // Calculate date range based on time frame
        const endDate = new Date();
        let startDate = new Date();
        
        switch (timeFrame) {
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '6m':
                startDate.setMonth(endDate.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            case '2y':
                startDate.setFullYear(endDate.getFullYear() - 2);
                break;
            default:
                startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        const query = `
            SELECT 
                COUNT(*) as total_changes,
                COUNT(*) FILTER (WHERE change_type = 'upgrade') as total_upgrades,
                COUNT(*) FILTER (WHERE change_type = 'downgrade') as total_downgrades,
                COUNT(DISTINCT ps_record_id) as ps_records_with_changes,
                COUNT(DISTINCT account_name) as accounts_affected,
                COUNT(DISTINCT deployment_number) as deployments_affected,
                COUNT(DISTINCT product_code) as products_changed
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
        `;
        
        const result = await pool.query(query, [startDate, endDate]);
        return {
            success: true,
            summary: result.rows[0],
            timeFrame: timeFrame,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    } catch (error) {
        console.error('❌ Error getting package change summary:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get package changes grouped by product
 * @param {string} timeFrame - Time frame filter
 * @returns {Promise<Object>} Product breakdown
 */
async function getPackageChangesByProduct(timeFrame = '1y') {
    try {
        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();
        
        switch (timeFrame) {
            case '30d': startDate.setDate(endDate.getDate() - 30); break;
            case '90d': startDate.setDate(endDate.getDate() - 90); break;
            case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
            case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
            default: startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        const query = `
            SELECT 
                product_code,
                product_name,
                COUNT(*) as total_changes,
                COUNT(*) FILTER (WHERE change_type = 'upgrade') as upgrades,
                COUNT(*) FILTER (WHERE change_type = 'downgrade') as downgrades,
                COUNT(DISTINCT ps_record_id) as ps_records,
                COUNT(DISTINCT account_name) as accounts
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
            GROUP BY product_code, product_name
            ORDER BY total_changes DESC
        `;
        
        const result = await pool.query(query, [startDate, endDate]);
        return {
            success: true,
            data: result.rows,
            count: result.rowCount,
            timeFrame: timeFrame
        };
    } catch (error) {
        console.error('❌ Error getting package changes by product:', error.message);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Get package changes grouped by account
 * @param {string} timeFrame - Time frame filter
 * @param {number} limit - Optional limit (default: null = no limit, show all accounts)
 * @returns {Promise<Object>} Account breakdown
 */
async function getPackageChangesByAccount(timeFrame = '1y', limit = null) {
    try {
        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();
        
        switch (timeFrame) {
            case '30d': startDate.setDate(endDate.getDate() - 30); break;
            case '90d': startDate.setDate(endDate.getDate() - 90); break;
            case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
            case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
            default: startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        // Get account-level summary
        // No limit - show all accounts with changes
        const accountQuery = `
            SELECT 
                account_name,
                account_id,
                COUNT(*) as total_changes,
                COUNT(*) FILTER (WHERE change_type = 'upgrade') as upgrades,
                COUNT(*) FILTER (WHERE change_type = 'downgrade') as downgrades,
                COUNT(DISTINCT ps_record_id) as ps_records,
                COUNT(DISTINCT deployment_number) as deployments,
                COUNT(DISTINCT product_code) as products_changed
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
            GROUP BY account_name, account_id
            ORDER BY total_changes DESC
        `;
        
        const accountResult = await pool.query(accountQuery, [startDate, endDate]);
        
        // Get deployment-level breakdown for each account
        const deploymentQuery = `
            SELECT 
                account_name,
                account_id,
                deployment_number,
                tenant_name,
                COUNT(*) as total_changes,
                COUNT(*) FILTER (WHERE change_type = 'upgrade') as upgrades,
                COUNT(*) FILTER (WHERE change_type = 'downgrade') as downgrades,
                COUNT(DISTINCT ps_record_id) as ps_records,
                COUNT(DISTINCT product_code) as products_changed
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
            GROUP BY account_name, account_id, deployment_number, tenant_name
            ORDER BY account_name, total_changes DESC
        `;
        
        const deploymentResult = await pool.query(deploymentQuery, [startDate, endDate]);
        
        // Get product-level breakdown for each account and deployment
        const productQuery = `
            SELECT 
                account_name,
                account_id,
                deployment_number,
                product_code,
                product_name,
                COUNT(*) as total_changes,
                COUNT(*) FILTER (WHERE change_type = 'upgrade') as upgrades,
                COUNT(*) FILTER (WHERE change_type = 'downgrade') as downgrades,
                COUNT(DISTINCT ps_record_id) as ps_records
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
            GROUP BY account_name, account_id, deployment_number, product_code, product_name
            ORDER BY account_name, deployment_number, total_changes DESC
        `;
        
        const productResult = await pool.query(productQuery, [startDate, endDate]);
        
        // Nest products under deployments under accounts
        const accountsWithDeployments = accountResult.rows.map(account => {
            // Get deployments for this account
            const deployments = deploymentResult.rows
                .filter(d => d.account_name === account.account_name)
                .map(deployment => {
                    // Get products for this deployment
                    const products = productResult.rows.filter(
                        p => p.account_name === account.account_name && 
                             p.deployment_number === deployment.deployment_number
                    );
                    return {
                        ...deployment,
                        products: products
                    };
                });
            
            return {
                ...account,
                deployments: deployments
            };
        });
        
        return {
            success: true,
            data: accountsWithDeployments,
            count: accountResult.rowCount,
            timeFrame: timeFrame
        };
    } catch (error) {
        console.error('❌ Error getting package changes by account:', error.message);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Get recent package changes
 * @param {string} timeFrame - Time frame filter
 * @param {number} limit - Maximum number of changes to return
 * @returns {Promise<Object>} Recent changes
 */
async function getRecentPackageChanges(timeFrame = '1y', limit = 20) {
    try {
        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();
        
        switch (timeFrame) {
            case '30d': startDate.setDate(endDate.getDate() - 30); break;
            case '90d': startDate.setDate(endDate.getDate() - 90); break;
            case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
            case '2y': startDate.setFullYear(endDate.getFullYear() - 2); break;
            default: startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        const query = `
            SELECT 
                ps_record_id, ps_record_name,
                previous_ps_record_id, previous_ps_record_name,
                deployment_number, tenant_name, account_name,
                product_code, product_name,
                previous_package, new_package, change_type,
                ps_created_date
            FROM package_change_analysis
            WHERE ps_created_date >= $1 AND ps_created_date <= $2
            ORDER BY ps_created_date DESC
            LIMIT $3
        `;
        
        const result = await pool.query(query, [startDate, endDate, limit]);
        return {
            success: true,
            data: result.rows,
            count: result.rowCount,
            timeFrame: timeFrame
        };
    } catch (error) {
        console.error('❌ Error getting recent package changes:', error.message);
        return { success: false, error: error.message, data: [] };
    }
}

// ===== SML TENANT DATA FUNCTIONS =====

/**
 * Upsert SML tenant data
 * @param {Object} tenantData - Tenant data from SML
 * @returns {Promise<Object>} Result
 */
async function upsertSMLTenant(tenantData) {
    try {
        const query = `
            INSERT INTO sml_tenant_data (
                tenant_id, tenant_name, account_name, tenant_display_name,
                is_deleted, raw_data, product_entitlements, last_synced, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id) 
            DO UPDATE SET
                tenant_name = EXCLUDED.tenant_name,
                account_name = EXCLUDED.account_name,
                tenant_display_name = EXCLUDED.tenant_display_name,
                is_deleted = EXCLUDED.is_deleted,
                raw_data = EXCLUDED.raw_data,
                product_entitlements = EXCLUDED.product_entitlements,
                last_synced = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `;
        
        const values = [
            tenantData.tenantId,
            tenantData.tenantName,
            tenantData.accountName || null,
            tenantData.tenantDisplayName || null,
            tenantData.isDeleted || false,
            tenantData.rawData ? JSON.stringify(tenantData.rawData) : null,
            tenantData.productEntitlements ? JSON.stringify(tenantData.productEntitlements) : null
        ];
        
        const result = await pool.query(query, values);
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error upserting SML tenant:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all SML tenants with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} List of tenants
 */
async function getSMLTenants(filters = {}) {
    try {
        let queryText = `
            SELECT 
                id, tenant_id, tenant_name, account_name, tenant_display_name,
                is_deleted, last_synced, created_at, updated_at
            FROM sml_tenant_data
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (filters.tenantSearch) {
            queryText += ` AND (tenant_name ILIKE $${paramCount} OR account_name ILIKE $${paramCount})`;
            params.push(`%${filters.tenantSearch}%`);
            paramCount++;
        }

        if (filters.accountName) {
            queryText += ` AND account_name = $${paramCount}`;
            params.push(filters.accountName);
            paramCount++;
        }

        if (filters.isDeleted !== undefined) {
            queryText += ` AND is_deleted = $${paramCount}`;
            params.push(filters.isDeleted);
            paramCount++;
        }

        queryText += ' ORDER BY tenant_name ASC';

        const result = await pool.query(queryText, params);
        return { success: true, tenants: result.rows, count: result.rowCount };
    } catch (error) {
        console.error('❌ Error getting SML tenants:', error.message);
        return { success: false, error: error.message, tenants: [] };
    }
}

/**
 * Get single SML tenant by tenant ID
 * @param {string} tenantId - SML tenant ID
 * @returns {Promise<Object>} Tenant data
 */
async function getSMLTenantById(tenantId) {
    try {
        const query = `
            SELECT 
                id, tenant_id, tenant_name, account_name, tenant_display_name,
                is_deleted, raw_data, product_entitlements, last_synced, created_at, updated_at
            FROM sml_tenant_data
            WHERE tenant_id = $1
        `;
        
        const result = await pool.query(query, [tenantId]);
        
        if (result.rowCount === 0) {
            return { success: false, error: 'Tenant not found', tenant: null };
        }
        
        return { success: true, tenant: result.rows[0] };
    } catch (error) {
        console.error('❌ Error getting SML tenant:', error.message);
        return { success: false, error: error.message, tenant: null };
    }
}

/**
 * Clear all SML tenant data (for refresh)
 * @returns {Promise<Object>} Result
 */
async function clearSMLTenants() {
    try {
        const result = await pool.query('DELETE FROM sml_tenant_data');
        console.log(`🗑️ Cleared ${result.rowCount} SML tenants from cache`);
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error('❌ Error clearing SML tenants:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Try to find account name for a tenant name by searching in existing tables
 * @param {string} tenantName - Tenant name to search for
 * @returns {Promise<Object>} Account name if found
 */
async function findAccountNameForTenant(tenantName) {
    try {
        // Search in ps_audit_trail table for tenant_name matching
        // Get the most recent record with this tenant name
        const query = `
            SELECT account_name
            FROM ps_audit_trail
            WHERE tenant_name = $1
            AND account_name IS NOT NULL
            AND account_name != ''
            ORDER BY last_modified_date DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [tenantName]);
        
        if (result.rowCount > 0) {
            return { success: true, accountName: result.rows[0].account_name };
        }
        
        return { success: false, accountName: null };
    } catch (error) {
        console.error('❌ Error finding account name for tenant:', error.message);
        return { success: false, error: error.message, accountName: null };
    }
}

// ===== SML GHOST ACCOUNTS FUNCTIONS =====

/**
 * Upsert SML ghost account
 * @param {Object} ghostAccountData - Ghost account data from SML
 * @returns {Promise<Object>} Result
 */
async function upsertSMLGhostAccount(ghostAccountData) {
    try {
        const query = `
            INSERT INTO sml_ghost_accounts (
                tenant_id, tenant_name, account_name, total_expired_products, 
                latest_expiry_date, last_checked, updated_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id) 
            DO UPDATE SET
                tenant_name = EXCLUDED.tenant_name,
                account_name = EXCLUDED.account_name,
                total_expired_products = EXCLUDED.total_expired_products,
                latest_expiry_date = EXCLUDED.latest_expiry_date,
                last_checked = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `;
        
        const values = [
            ghostAccountData.tenantId,
            ghostAccountData.tenantName,
            ghostAccountData.accountName || null,
            ghostAccountData.totalExpiredProducts,
            ghostAccountData.latestExpiryDate
        ];
        
        const result = await pool.query(query, values);
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error upserting SML ghost account:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all SML ghost accounts with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} List of ghost accounts
 */
async function getSMLGhostAccounts(filters = {}) {
    try {
        let queryText = `
            SELECT 
                id, tenant_id, tenant_name, account_name, total_expired_products,
                latest_expiry_date, last_checked, is_reviewed,
                reviewed_at, reviewed_by, notes, data_source, created_at, updated_at
            FROM sml_ghost_accounts
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

        // Filter by tenant/account name search
        if (filters.accountSearch) {
            queryText += ` AND (tenant_name ILIKE $${paramCount} OR account_name ILIKE $${paramCount})`;
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

        queryText += ' ORDER BY latest_expiry_date DESC, tenant_name ASC';

        const result = await pool.query(queryText, params);
        return { success: true, ghostAccounts: result.rows, count: result.rowCount };
    } catch (error) {
        console.error('❌ Error getting SML ghost accounts:', error.message);
        return { success: false, error: error.message, ghostAccounts: [] };
    }
}

/**
 * Mark SML ghost account as reviewed
 * @param {string} tenantId - Tenant ID
 * @param {string} reviewedBy - Username/email of reviewer
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Result
 */
async function markSMLGhostAccountReviewed(tenantId, reviewedBy, notes = null) {
    try {
        const query = `
            UPDATE sml_ghost_accounts
            SET 
                is_reviewed = TRUE,
                reviewed_at = CURRENT_TIMESTAMP,
                reviewed_by = $2,
                notes = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE tenant_id = $1
            RETURNING id
        `;
        
        const values = [tenantId, reviewedBy, notes];
        const result = await pool.query(query, values);
        
        if (result.rowCount === 0) {
            return { success: false, error: 'Tenant not found' };
        }
        
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('❌ Error marking SML ghost account as reviewed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Remove SML ghost account from tracking
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Result
 */
async function removeSMLGhostAccount(tenantId) {
    try {
        const query = `DELETE FROM sml_ghost_accounts WHERE tenant_id = $1`;
        const result = await pool.query(query, [tenantId]);
        
        return { success: true, deleted: result.rowCount > 0 };
    } catch (error) {
        console.error('❌ Error removing SML ghost account:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Clear all SML ghost accounts (for refresh)
 * @returns {Promise<Object>} Result
 */
async function clearSMLGhostAccounts() {
    try {
        const result = await pool.query('DELETE FROM sml_ghost_accounts');
        console.log(`🗑️ Cleared ${result.rowCount} SML ghost accounts from cache`);
        return { success: true, deletedCount: result.rowCount };
    } catch (error) {
        console.error('❌ Error clearing SML ghost accounts:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get SML ghost accounts summary statistics
 * @returns {Promise<Object>} Summary data
 */
async function getSMLGhostAccountsSummary() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_ghost_accounts,
                COUNT(*) FILTER (WHERE is_reviewed = false) as unreviewed,
                COUNT(*) FILTER (WHERE is_reviewed = true) as reviewed,
                MIN(latest_expiry_date) as earliest_expiry,
                MAX(latest_expiry_date) as most_recent_expiry,
                SUM(total_expired_products) as total_expired_products
            FROM sml_ghost_accounts
        `;
        
        const result = await pool.query(query);
        return { success: true, summary: result.rows[0] };
    } catch (error) {
        console.error('❌ Error getting SML ghost accounts summary:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get unique expired products from all SML ghost accounts
 * Returns a list of unique product codes/names for filtering
 * @returns {Promise<Object>} List of unique products
 */
async function getSMLUniqueExpiredProducts() {
    try {
        // Query each category separately to maintain category information
        const query = `
            SELECT DISTINCT
                'apps' as category,
                jsonb_array_elements(st.product_entitlements->'appEntitlements') as product_data
            FROM sml_ghost_accounts sg
            JOIN sml_tenant_data st ON sg.tenant_id = st.tenant_id
            WHERE st.product_entitlements IS NOT NULL
            AND st.product_entitlements ? 'appEntitlements'
            
            UNION ALL
            
            SELECT DISTINCT
                'models' as category,
                jsonb_array_elements(st.product_entitlements->'modelEntitlements') as product_data
            FROM sml_ghost_accounts sg
            JOIN sml_tenant_data st ON sg.tenant_id = st.tenant_id
            WHERE st.product_entitlements IS NOT NULL
            AND st.product_entitlements ? 'modelEntitlements'
            
            UNION ALL
            
            SELECT DISTINCT
                'data' as category,
                jsonb_array_elements(st.product_entitlements->'dataEntitlements') as product_data
            FROM sml_ghost_accounts sg
            JOIN sml_tenant_data st ON sg.tenant_id = st.tenant_id
            WHERE st.product_entitlements IS NOT NULL
            AND st.product_entitlements ? 'dataEntitlements'
        `;
        
        const result = await pool.query(query);
        
        // Extract product codes and names, filter for expired products only
        const productsMap = new Map();
        const today = new Date();
        
        for (const row of result.rows) {
            const product = row.product_data;
            const category = row.category;
            if (!product) continue;
            
            // Check if product is expired
            const endDate = product.endDate ? new Date(product.endDate) : null;
            if (endDate && endDate < today) {
                const productCode = product.productCode || product.code;
                const productName = product.productName || product.name;
                
                if (productCode && !productsMap.has(productCode)) {
                    productsMap.set(productCode, {
                        productCode: productCode,
                        productName: productName || productCode,
                        category: category
                    });
                }
            }
        }
        
        // Group products by category
        const productsByCategory = {
            apps: [],
            models: [],
            data: []
        };
        
        for (const product of productsMap.values()) {
            if (product.category && productsByCategory[product.category]) {
                productsByCategory[product.category].push(product);
            }
        }
        
        // Sort products within each category
        productsByCategory.apps.sort((a, b) => a.productName.localeCompare(b.productName));
        productsByCategory.models.sort((a, b) => a.productName.localeCompare(b.productName));
        productsByCategory.data.sort((a, b) => a.productName.localeCompare(b.productName));
        
        const totalCount = productsByCategory.apps.length + 
                          productsByCategory.models.length + 
                          productsByCategory.data.length;
        
        return { 
            success: true, 
            productsByCategory: productsByCategory,
            count: totalCount 
        };
    } catch (error) {
        console.error('❌ Error getting unique expired products:', error.message);
        return { success: false, error: error.message, productsByCategory: { apps: [], models: [], data: [] } };
    }
}

/**
 * Get SML ghost accounts filtered by product
 * @param {Object} filters - Filter criteria including productCode
 * @returns {Promise<Object>} List of ghost accounts with the specified product
 */
async function getSMLGhostAccountsByProduct(filters = {}) {
    try {
        if (!filters.productCodes || filters.productCodes.length === 0) {
            // If no product filter, use the regular function
            return getSMLGhostAccounts(filters);
        }
        
        // Support both single productCode (for backwards compatibility) and array productCodes
        const productCodes = Array.isArray(filters.productCodes) 
            ? filters.productCodes 
            : [filters.productCode || filters.productCodes];
        
        // Query that filters ghost accounts by checking if they have any of the specified expired products
        let queryText = `
            SELECT DISTINCT
                sg.id, sg.tenant_id, sg.tenant_name, sg.account_name, sg.total_expired_products,
                sg.latest_expiry_date, sg.last_checked, sg.is_reviewed,
                sg.reviewed_at, sg.reviewed_by, sg.notes, sg.data_source, sg.created_at, sg.updated_at
            FROM sml_ghost_accounts sg
            JOIN sml_tenant_data st ON sg.tenant_id = st.tenant_id
            WHERE st.product_entitlements IS NOT NULL
            AND (
                EXISTS (
                    SELECT 1 FROM jsonb_array_elements(st.product_entitlements->'appEntitlements') AS app
                    WHERE (app->>'productCode' = ANY($1) OR app->>'code' = ANY($1))
                    AND (app->>'endDate')::timestamp < NOW()
                )
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(st.product_entitlements->'modelEntitlements') AS model
                    WHERE (model->>'productCode' = ANY($1) OR model->>'code' = ANY($1))
                    AND (model->>'endDate')::timestamp < NOW()
                )
                OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(st.product_entitlements->'dataEntitlements') AS data
                    WHERE (data->>'productCode' = ANY($1) OR data->>'code' = ANY($1))
                    AND (data->>'endDate')::timestamp < NOW()
                )
            )
        `;
        
        const params = [productCodes];
        let paramCount = 2;
        
        // Add additional filters
        if (filters.isReviewed !== undefined) {
            queryText += ` AND sg.is_reviewed = $${paramCount}`;
            params.push(filters.isReviewed);
            paramCount++;
        }
        
        if (filters.accountSearch) {
            queryText += ` AND (sg.tenant_name ILIKE $${paramCount} OR sg.account_name ILIKE $${paramCount})`;
            params.push(`%${filters.accountSearch}%`);
            paramCount++;
        }
        
        if (filters.expiryBefore) {
            queryText += ` AND sg.latest_expiry_date <= $${paramCount}`;
            params.push(filters.expiryBefore);
            paramCount++;
        }
        
        if (filters.expiryAfter) {
            queryText += ` AND sg.latest_expiry_date >= $${paramCount}`;
            params.push(filters.expiryAfter);
            paramCount++;
        }
        
        queryText += ' ORDER BY sg.latest_expiry_date DESC, sg.tenant_name ASC';
        
        const result = await pool.query(queryText, params);
        return { success: true, ghostAccounts: result.rows, count: result.rowCount };
    } catch (error) {
        console.error('❌ Error getting SML ghost accounts by product:', error.message);
        return { success: false, error: error.message, ghostAccounts: [] };
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
    getAccount,
    getAllAccountsSummary,
    // Ghost accounts functions
    getUniqueAccountsFromExpiration,
    upsertGhostAccount,
    getGhostAccounts,
    markGhostAccountReviewed,
    removeGhostAccount,
    clearGhostAccounts,
    getGhostAccountsSummary,
    // SML tenant data functions
    upsertSMLTenant,
    getSMLTenants,
    getSMLTenantById,
    clearSMLTenants,
    findAccountNameForTenant,
    // SML ghost accounts functions
    upsertSMLGhostAccount,
    getSMLGhostAccounts,
    getSMLGhostAccountsByProduct,
    getSMLUniqueExpiredProducts,
    markSMLGhostAccountReviewed,
    removeSMLGhostAccount,
    clearSMLGhostAccounts,
    getSMLGhostAccountsSummary,
    // Package functions
    upsertPackage,
    getPackageById,
    getPackageBySfId,
    getPackageByName,
    getAllPackages,
    getBasePackages,
    getExpansionPackages,
    getPackagesSummary,
    clearPackages,
    // Package change analysis functions
    clearPackageChangeCache,
    insertPackageChangeData,
    logPackageChangeAnalysis,
    getLatestPackageChangeAnalysisStatus,
    getPackageChangeSummary,
    getPackageChangesByProduct,
    getPackageChangesByAccount,
    getRecentPackageChanges
};
