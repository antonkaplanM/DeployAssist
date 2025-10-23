-- Product Update Workflow Database Schema
-- This schema supports the workflow for creating product update requests from the Customer Products page

-- Table to store reference data for dropdown options (extracted from PS records)
CREATE TABLE IF NOT EXISTS product_update_options (
    id SERIAL PRIMARY KEY,
    option_type VARCHAR(50) NOT NULL,  -- 'package', 'product', 'modifier', 'region'
    option_value VARCHAR(255) NOT NULL,
    option_label VARCHAR(255) NOT NULL,
    category VARCHAR(50),  -- 'models', 'data', 'apps', or NULL for general options
    metadata JSONB,  -- Additional metadata like product codes, descriptions, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique option values per type and category
    CONSTRAINT unique_option UNIQUE (option_type, option_value, category)
);

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_product_options_type ON product_update_options(option_type);
CREATE INDEX IF NOT EXISTS idx_product_options_category ON product_update_options(category);
CREATE INDEX IF NOT EXISTS idx_product_options_active ON product_update_options(is_active);

-- Table to store pending product update requests
CREATE TABLE IF NOT EXISTS product_update_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL,  -- PUR-XXXXX format
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),
    
    -- Request metadata
    requested_by VARCHAR(255) NOT NULL,  -- User who created the request
    request_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'processing', 'completed', 'failed'
    priority VARCHAR(20) DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'
    
    -- Request details
    request_type VARCHAR(50) NOT NULL,  -- 'add', 'remove', 'modify'
    region VARCHAR(100),
    
    -- Store the actual changes as JSON
    changes_requested JSONB NOT NULL,  -- {added: [], removed: [], modified: []}
    
    -- Processing information
    ps_record_id VARCHAR(255),  -- Salesforce PS record ID once created
    ps_record_name VARCHAR(100),  -- PS-XXXXX format
    error_message TEXT,
    
    -- Notes and comments
    request_notes TEXT,
    approval_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pur_account_name ON product_update_requests(account_name);
CREATE INDEX IF NOT EXISTS idx_pur_status ON product_update_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_pur_requested_by ON product_update_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_pur_created_at ON product_update_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pur_request_number ON product_update_requests(request_number);

-- Table to track request status history
CREATE TABLE IF NOT EXISTS product_update_request_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES product_update_requests(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255) NOT NULL,
    change_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for history lookups
CREATE INDEX IF NOT EXISTS idx_pur_history_request_id ON product_update_request_history(request_id);
CREATE INDEX IF NOT EXISTS idx_pur_history_created_at ON product_update_request_history(created_at DESC);

-- Function to generate unique request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS VARCHAR AS $$
DECLARE
    next_number INTEGER;
    request_num VARCHAR(50);
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_number
    FROM product_update_requests
    WHERE request_number LIKE 'PUR-%';
    
    -- Format as PUR-XXXXX (5 digits, zero-padded)
    request_num := 'PUR-' || LPAD(next_number::TEXT, 5, '0');
    
    RETURN request_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on product_update_requests
CREATE TRIGGER update_product_update_requests_updated_at
    BEFORE UPDATE ON product_update_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on product_update_options
CREATE TRIGGER update_product_update_options_updated_at
    BEFORE UPDATE ON product_update_options
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create status history entry when status changes
CREATE OR REPLACE FUNCTION track_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if status actually changed
    IF OLD.request_status IS DISTINCT FROM NEW.request_status THEN
        INSERT INTO product_update_request_history (
            request_id,
            previous_status,
            new_status,
            changed_by,
            change_notes
        ) VALUES (
            NEW.id,
            OLD.request_status,
            NEW.request_status,
            COALESCE(NEW.requested_by, 'system'),
            'Status changed from ' || COALESCE(OLD.request_status, 'none') || ' to ' || NEW.request_status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track status changes
CREATE TRIGGER track_product_update_request_status
    AFTER UPDATE ON product_update_requests
    FOR EACH ROW
    EXECUTE FUNCTION track_request_status_change();

-- View to get pending requests with formatted data
CREATE OR REPLACE VIEW pending_product_updates AS
SELECT 
    pur.id,
    pur.request_number,
    pur.account_name,
    pur.requested_by,
    pur.request_status,
    pur.priority,
    pur.request_type,
    pur.region,
    pur.changes_requested,
    pur.request_notes,
    pur.created_at,
    pur.submitted_at,
    pur.ps_record_name,
    -- Calculate counts from changes_requested JSON
    COALESCE(jsonb_array_length(pur.changes_requested->'added'), 0) as items_to_add,
    COALESCE(jsonb_array_length(pur.changes_requested->'removed'), 0) as items_to_remove,
    COALESCE(jsonb_array_length(pur.changes_requested->'modified'), 0) as items_to_modify
FROM product_update_requests pur
WHERE pur.request_status IN ('pending', 'approved', 'processing')
ORDER BY pur.created_at DESC;

-- Seed some initial product update options from common PS record patterns
-- These will be populated by extracting data from ps_audit_trail

-- Insert common regions
INSERT INTO product_update_options (option_type, option_value, option_label, category, is_active)
VALUES 
    ('region', 'US', 'United States', NULL, true),
    ('region', 'EU', 'Europe', NULL, true),
    ('region', 'APAC', 'Asia Pacific', NULL, true),
    ('region', 'UK', 'United Kingdom', NULL, true)
ON CONFLICT (option_type, option_value, category) DO NOTHING;

-- Insert common modifiers
INSERT INTO product_update_options (option_type, option_value, option_label, category, is_active)
VALUES 
    ('modifier', 'Standard', 'Standard', NULL, true),
    ('modifier', 'Premium', 'Premium', NULL, true),
    ('modifier', 'Enterprise', 'Enterprise', NULL, true),
    ('modifier', 'Trial', 'Trial', NULL, true),
    ('modifier', 'POC', 'Proof of Concept', NULL, true)
ON CONFLICT (option_type, option_value, category) DO NOTHING;

-- Function to extract and populate product options from PS audit trail
CREATE OR REPLACE FUNCTION refresh_product_options()
RETURNS TABLE (
    packages_added INTEGER,
    products_added INTEGER
) AS $$
DECLARE
    pkg_count INTEGER := 0;
    prod_count INTEGER := 0;
BEGIN
    -- Extract unique packages from payload data
    WITH package_data AS (
        SELECT DISTINCT
            jsonb_array_elements(
                COALESCE(
                    (payload_data::jsonb->'modelEntitlements'),
                    '[]'::jsonb
                ) ||
                COALESCE(
                    (payload_data::jsonb->'dataEntitlements'),
                    '[]'::jsonb
                ) ||
                COALESCE(
                    (payload_data::jsonb->'appEntitlements'),
                    '[]'::jsonb
                )
            )->>'packageName' as package_name
        FROM ps_audit_trail
        WHERE payload_data IS NOT NULL 
        AND payload_data::jsonb IS NOT NULL
        AND status = 'Tenant Request Completed'
    )
    INSERT INTO product_update_options (option_type, option_value, option_label, category)
    SELECT 
        'package',
        package_name,
        package_name,
        NULL
    FROM package_data
    WHERE package_name IS NOT NULL AND package_name != ''
    ON CONFLICT (option_type, option_value, category) DO NOTHING;
    
    GET DIAGNOSTICS pkg_count = ROW_COUNT;
    
    -- Extract unique product codes with metadata
    WITH product_data AS (
        SELECT DISTINCT
            jsonb_array_elements(
                COALESCE((payload_data::jsonb->'modelEntitlements'), '[]'::jsonb)
            ) as product_obj,
            'models' as category
        FROM ps_audit_trail
        WHERE payload_data IS NOT NULL AND status = 'Tenant Request Completed'
        
        UNION ALL
        
        SELECT DISTINCT
            jsonb_array_elements(
                COALESCE((payload_data::jsonb->'dataEntitlements'), '[]'::jsonb)
            ) as product_obj,
            'data' as category
        FROM ps_audit_trail
        WHERE payload_data IS NOT NULL AND status = 'Tenant Request Completed'
        
        UNION ALL
        
        SELECT DISTINCT
            jsonb_array_elements(
                COALESCE((payload_data::jsonb->'appEntitlements'), '[]'::jsonb)
            ) as product_obj,
            'apps' as category
        FROM ps_audit_trail
        WHERE payload_data IS NOT NULL AND status = 'Tenant Request Completed'
    )
    INSERT INTO product_update_options (option_type, option_value, option_label, category, metadata)
    SELECT 
        'product',
        product_obj->>'productCode',
        COALESCE(product_obj->>'name', product_obj->>'productCode'),
        category,
        jsonb_build_object(
            'productCode', product_obj->>'productCode',
            'productName', product_obj->>'name'
        )
    FROM product_data
    WHERE product_obj->>'productCode' IS NOT NULL AND product_obj->>'productCode' != ''
    ON CONFLICT (option_type, option_value, category) DO NOTHING;
    
    GET DIAGNOSTICS prod_count = ROW_COUNT;
    
    RETURN QUERY SELECT pkg_count, prod_count;
END;
$$ LANGUAGE plpgsql;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Product Update Workflow system initialized successfully';
    RAISE NOTICE '📋 Created tables: product_update_options, product_update_requests, product_update_request_history';
    RAISE NOTICE '📊 Created view: pending_product_updates';
    RAISE NOTICE '🔍 Created functions: generate_request_number, refresh_product_options';
    RAISE NOTICE '⚡ Created triggers for automatic timestamp updates and status tracking';
END $$;

