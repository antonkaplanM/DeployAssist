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
    getLatestAnalysisStatus
};
