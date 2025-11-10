-- Package-Product Mapping Table
-- Stores the relationship between packages and products discovered from PS audit trail data

CREATE TABLE IF NOT EXISTS package_product_mapping (
    id SERIAL PRIMARY KEY,
    
    -- Package information
    package_name VARCHAR(255) NOT NULL,
    
    -- Product information
    product_code VARCHAR(255) NOT NULL,
    
    -- Mapping metadata
    confidence_score DECIMAL(3,2) DEFAULT 1.0,  -- Confidence in this mapping (0.0-1.0)
    source VARCHAR(50) DEFAULT 'ps_audit_trail',  -- Where this mapping came from
    occurrence_count INTEGER DEFAULT 1,  -- How many times we've seen this mapping
    
    -- Timestamps
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique package-product combinations
    CONSTRAINT unique_package_product UNIQUE (package_name, product_code)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pkg_prod_mapping_package ON package_product_mapping(package_name);
CREATE INDEX IF NOT EXISTS idx_pkg_prod_mapping_product ON package_product_mapping(product_code);
CREATE INDEX IF NOT EXISTS idx_pkg_prod_mapping_source ON package_product_mapping(source);

-- View to get packages with their associated products
CREATE OR REPLACE VIEW packages_with_products AS
SELECT 
    p.id as package_id,
    p.package_name,
    p.ri_package_name,
    p.package_type,
    p.sf_package_id,
    json_agg(
        json_build_object(
            'product_code', m.product_code,
            'confidence_score', m.confidence_score,
            'occurrence_count', m.occurrence_count
        ) ORDER BY m.occurrence_count DESC
    ) FILTER (WHERE m.product_code IS NOT NULL) as products
FROM packages p
LEFT JOIN package_product_mapping m ON p.package_name = m.package_name OR p.ri_package_name = m.package_name
GROUP BY p.id, p.package_name, p.ri_package_name, p.package_type, p.sf_package_id;

-- View to get products with their associated packages
CREATE OR REPLACE VIEW products_with_packages AS
SELECT 
    pr.id as product_id,
    pr.name as product_name,
    pr.product_code,
    pr.family,
    pr.salesforce_id,
    json_agg(
        json_build_object(
            'package_name', m.package_name,
            'confidence_score', m.confidence_score,
            'occurrence_count', m.occurrence_count
        ) ORDER BY m.occurrence_count DESC
    ) FILTER (WHERE m.package_name IS NOT NULL) as packages
FROM products pr
LEFT JOIN package_product_mapping m ON pr.product_code = m.product_code
GROUP BY pr.id, pr.name, pr.product_code, pr.family, pr.salesforce_id;

-- Function to update occurrence count for existing mappings
CREATE OR REPLACE FUNCTION upsert_package_product_mapping(
    p_package_name VARCHAR,
    p_product_code VARCHAR,
    p_source VARCHAR DEFAULT 'ps_audit_trail'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO package_product_mapping (
        package_name,
        product_code,
        source,
        occurrence_count,
        first_seen,
        last_seen
    )
    VALUES (
        p_package_name,
        p_product_code,
        p_source,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (package_name, product_code)
    DO UPDATE SET
        occurrence_count = package_product_mapping.occurrence_count + 1,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to get products for a package
CREATE OR REPLACE FUNCTION get_products_for_package(p_package_name VARCHAR)
RETURNS TABLE (
    product_code VARCHAR,
    confidence_score DECIMAL,
    occurrence_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.product_code,
        m.confidence_score,
        m.occurrence_count
    FROM package_product_mapping m
    WHERE m.package_name = p_package_name
    ORDER BY m.occurrence_count DESC, m.product_code;
END;
$$ LANGUAGE plpgsql;

-- Function to get packages for a product
CREATE OR REPLACE FUNCTION get_packages_for_product(p_product_code VARCHAR)
RETURNS TABLE (
    package_name VARCHAR,
    confidence_score DECIMAL,
    occurrence_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.package_name,
        m.confidence_score,
        m.occurrence_count
    FROM package_product_mapping m
    WHERE m.product_code = p_product_code
    ORDER BY m.occurrence_count DESC, m.package_name;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_package_product_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_package_product_mapping_timestamp
    BEFORE UPDATE ON package_product_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_package_product_mapping_timestamp();

-- Log the creation
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'package_product_mapping_table_created',
    'system',
    NULL,
    '{"table": "package_product_mapping", "version": "1.0.0"}'::jsonb,
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Package-Product mapping table created successfully';
    RAISE NOTICE '📦 Table: package_product_mapping';
    RAISE NOTICE '👁️  Views: packages_with_products, products_with_packages';
    RAISE NOTICE '⚡ Functions: upsert_package_product_mapping, get_products_for_package, get_packages_for_product';
END $$;


