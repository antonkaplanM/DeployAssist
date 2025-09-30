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

module.exports = {
    query,
    getClient,
    testConnection,
    closePool,
    transaction,
    getPoolStats,
    pool // Export pool for advanced usage
};
