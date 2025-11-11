// Product Update Workflow Service
// Handles all business logic for product update requests

const db = require('../database');

/**
 * Get product update options for dropdown menus
 * @param {string} optionType - 'package', 'product', 'modifier', 'region'
 * @param {string} category - Optional category filter ('models', 'data', 'apps')
 * @returns {Promise<Object>} Options data
 */
async function getProductOptions(optionType, category = null) {
    try {
        console.log(`📋 Fetching product options: ${optionType}${category ? ` (${category})` : ''}`);
        
        let query = `
            SELECT 
                id,
                option_type,
                option_value,
                option_label,
                category,
                metadata
            FROM product_update_options
            WHERE option_type = $1
            AND is_active = true
        `;
        
        const params = [optionType];
        
        if (category) {
            query += ` AND (category = $2 OR category IS NULL)`;
            params.push(category);
        }
        
        query += ` ORDER BY option_label ASC`;
        
        const result = await db.query(query, params);
        
        return {
            success: true,
            options: result.rows.map(row => ({
                id: row.id,
                value: row.option_value,
                label: row.option_label,
                category: row.category,
                metadata: row.metadata
            })),
            count: result.rows.length
        };
    } catch (error) {
        console.error('❌ Error fetching product options:', error.message);
        return {
            success: false,
            error: error.message,
            options: []
        };
    }
}

/**
 * Get all options needed for the product update modal
 * @returns {Promise<Object>} All options organized by type
 */
async function getAllProductOptions() {
    try {
        console.log('📋 Fetching all product options...');
        
        const [packages, modifiers, regions, modelsProducts, dataProducts, appsProducts] = await Promise.all([
            getProductOptions('package'),
            getProductOptions('modifier'),
            getProductOptions('region'),
            getProductOptions('product', 'models'),
            getProductOptions('product', 'data'),
            getProductOptions('product', 'apps')
        ]);
        
        return {
            success: true,
            options: {
                packages: packages.options,
                modifiers: modifiers.options,
                regions: regions.options,
                products: {
                    models: modelsProducts.options,
                    data: dataProducts.options,
                    apps: appsProducts.options
                }
            }
        };
    } catch (error) {
        console.error('❌ Error fetching all product options:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create a new product update request
 * @param {Object} requestData - The request details
 * @returns {Promise<Object>} Created request
 */
async function createProductUpdateRequest(requestData) {
    const client = await db.getClient();
    
    try {
        console.log('📝 Creating product update request...');
        
        await client.query('BEGIN');
        
        // Generate request number
        const requestNumberResult = await client.query('SELECT generate_request_number() as request_number');
        const requestNumber = requestNumberResult.rows[0].request_number;
        
        // Insert the request
        const insertQuery = `
            INSERT INTO product_update_requests (
                request_number,
                account_name,
                account_id,
                requested_by,
                request_status,
                priority,
                request_type,
                region,
                changes_requested,
                request_notes,
                submitted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        
        const insertParams = [
            requestNumber,
            requestData.accountName,
            requestData.accountId || null,
            requestData.requestedBy,
            'pending',
            requestData.priority || 'normal',
            requestData.requestType || 'modify',
            requestData.region || null,
            JSON.stringify(requestData.changes),
            requestData.notes || null
        ];
        
        const result = await client.query(insertQuery, insertParams);
        
        await client.query('COMMIT');
        
        console.log(`✅ Created product update request: ${requestNumber}`);
        
        return {
            success: true,
            request: formatProductUpdateRequest(result.rows[0])
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating product update request:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        client.release();
    }
}

/**
 * Get pending product update requests
 * @param {Object} filters - Optional filters (accountName, status, requestedBy)
 * @returns {Promise<Object>} List of pending requests
 */
async function getPendingProductUpdateRequests(filters = {}) {
    try {
        console.log('📋 Fetching pending product update requests...');
        
        let query = `
            SELECT 
                id,
                request_number,
                account_name,
                requested_by,
                request_status,
                priority,
                request_type,
                region,
                changes_requested,
                request_notes,
                ps_record_name,
                created_at,
                submitted_at,
                updated_at
            FROM product_update_requests
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (filters.accountName) {
            query += ` AND account_name = $${paramIndex}`;
            params.push(filters.accountName);
            paramIndex++;
        }
        
        if (filters.status) {
            query += ` AND request_status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }
        
        if (filters.requestedBy) {
            query += ` AND requested_by = $${paramIndex}`;
            params.push(filters.requestedBy);
            paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await db.query(query, params);
        
        return {
            success: true,
            requests: result.rows.map(formatProductUpdateRequest),
            count: result.rows.length
        };
        
    } catch (error) {
        console.error('❌ Error fetching pending requests:', error.message);
        return {
            success: false,
            error: error.message,
            requests: []
        };
    }
}

/**
 * Get a specific product update request by ID or request number
 * @param {string} identifier - Request ID or request number
 * @returns {Promise<Object>} Request details
 */
async function getProductUpdateRequest(identifier) {
    try {
        console.log(`🔍 Fetching product update request: ${identifier}`);
        
        const query = `
            SELECT 
                id,
                request_number,
                account_name,
                account_id,
                requested_by,
                request_status,
                priority,
                request_type,
                region,
                changes_requested,
                request_notes,
                approval_notes,
                ps_record_id,
                ps_record_name,
                error_message,
                created_at,
                submitted_at,
                approved_at,
                completed_at,
                updated_at
            FROM product_update_requests
            WHERE id = $1 OR request_number = $2
        `;
        
        const result = await db.query(query, [identifier, identifier]);
        
        if (result.rows.length === 0) {
            return {
                success: false,
                error: 'Request not found'
            };
        }
        
        return {
            success: true,
            request: formatProductUpdateRequest(result.rows[0])
        };
        
    } catch (error) {
        console.error('❌ Error fetching request:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update product update request status
 * @param {string} identifier - Request ID or request number
 * @param {string} newStatus - New status
 * @param {Object} updateData - Additional update data
 * @returns {Promise<Object>} Updated request
 */
async function updateProductUpdateRequestStatus(identifier, newStatus, updateData = {}) {
    try {
        console.log(`🔄 Updating request ${identifier} to status: ${newStatus}`);
        
        const updates = ['request_status = $1'];
        const params = [newStatus];
        let paramIndex = 2;
        
        if (updateData.approvalNotes) {
            updates.push(`approval_notes = $${paramIndex}`);
            params.push(updateData.approvalNotes);
            paramIndex++;
        }
        
        if (updateData.errorMessage) {
            updates.push(`error_message = $${paramIndex}`);
            params.push(updateData.errorMessage);
            paramIndex++;
        }
        
        if (updateData.psRecordId) {
            updates.push(`ps_record_id = $${paramIndex}`);
            params.push(updateData.psRecordId);
            paramIndex++;
        }
        
        if (updateData.psRecordName) {
            updates.push(`ps_record_name = $${paramIndex}`);
            params.push(updateData.psRecordName);
            paramIndex++;
        }
        
        // Update status-specific timestamp
        if (newStatus === 'approved') {
            updates.push('approved_at = CURRENT_TIMESTAMP');
        } else if (newStatus === 'completed') {
            updates.push('completed_at = CURRENT_TIMESTAMP');
        }
        
        params.push(identifier, identifier);
        
        const query = `
            UPDATE product_update_requests
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex} OR request_number = $${paramIndex + 1}
            RETURNING *
        `;
        
        const result = await db.query(query, params);
        
        if (result.rows.length === 0) {
            return {
                success: false,
                error: 'Request not found'
            };
        }
        
        console.log(`✅ Updated request ${identifier} to ${newStatus}`);
        
        return {
            success: true,
            request: formatProductUpdateRequest(result.rows[0])
        };
        
    } catch (error) {
        console.error('❌ Error updating request status:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete a product update request
 * @param {string} identifier - Request ID or request number
 * @returns {Promise<Object>} Deletion result
 */
async function deleteProductUpdateRequest(identifier) {
    try {
        console.log(`🗑️  Deleting product update request: ${identifier}`);
        
        const query = `
            DELETE FROM product_update_requests
            WHERE id = $1 OR request_number = $2
            RETURNING request_number
        `;
        
        const result = await db.query(query, [identifier, identifier]);
        
        if (result.rows.length === 0) {
            return {
                success: false,
                error: 'Request not found'
            };
        }
        
        console.log(`✅ Deleted request: ${result.rows[0].request_number}`);
        
        return {
            success: true,
            deletedRequestNumber: result.rows[0].request_number
        };
        
    } catch (error) {
        console.error('❌ Error deleting request:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get request history
 * @param {string} identifier - Request ID or request number
 * @returns {Promise<Object>} Request history
 */
async function getProductUpdateRequestHistory(identifier) {
    try {
        console.log(`📜 Fetching request history: ${identifier}`);
        
        const query = `
            SELECT 
                h.id,
                h.previous_status,
                h.new_status,
                h.changed_by,
                h.change_notes,
                h.created_at
            FROM product_update_request_history h
            JOIN product_update_requests r ON h.request_id = r.id
            WHERE r.id = $1 OR r.request_number = $2
            ORDER BY h.created_at DESC
        `;
        
        const result = await db.query(query, [identifier, identifier]);
        
        return {
            success: true,
            history: result.rows,
            count: result.rows.length
        };
        
    } catch (error) {
        console.error('❌ Error fetching request history:', error.message);
        return {
            success: false,
            error: error.message,
            history: []
        };
    }
}

/**
 * Format product update request for API response
 * @param {Object} row - Database row
 * @returns {Object} Formatted request
 */
function formatProductUpdateRequest(row) {
    return {
        id: row.id,
        requestNumber: row.request_number,
        accountName: row.account_name,
        accountId: row.account_id,
        requestedBy: row.requested_by,
        status: row.request_status,
        priority: row.priority,
        requestType: row.request_type,
        region: row.region,
        changes: row.changes_requested,
        notes: row.request_notes,
        approvalNotes: row.approval_notes,
        psRecordId: row.ps_record_id,
        psRecordName: row.ps_record_name,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at
    };
}

/**
 * Refresh product options from PS audit trail
 * @returns {Promise<Object>} Refresh result
 */
async function refreshProductOptions() {
    try {
        console.log('🔄 Refreshing product options from PS audit trail...');
        
        const result = await db.query('SELECT * FROM refresh_product_options()');
        
        if (result.rows && result.rows.length > 0) {
            const { packages_added, products_added } = result.rows[0];
            
            console.log(`✅ Refreshed product options: ${packages_added} packages, ${products_added} products`);
            
            return {
                success: true,
                packagesAdded: packages_added,
                productsAdded: products_added
            };
        }
        
        return {
            success: true,
            packagesAdded: 0,
            productsAdded: 0
        };
        
    } catch (error) {
        console.error('❌ Error refreshing product options:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getProductOptions,
    getAllProductOptions,
    createProductUpdateRequest,
    getPendingProductUpdateRequests,
    getProductUpdateRequest,
    updateProductUpdateRequestStatus,
    deleteProductUpdateRequest,
    getProductUpdateRequestHistory,
    refreshProductOptions
};

