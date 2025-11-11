-- Add Product Bundles Feature
-- Migration to add bundle management tables and update pages
-- Date: October 31, 2025

-- ===== CREATE PRODUCT BUNDLES TABLE =====
CREATE TABLE IF NOT EXISTS product_bundles (
    id SERIAL PRIMARY KEY,
    bundle_id VARCHAR(50) UNIQUE NOT NULL,  -- Sequential: BUNDLE-001, BUNDLE-002, etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure bundle name is unique
    CONSTRAINT unique_bundle_name UNIQUE (name)
);

-- Create indexes for bundles
CREATE INDEX IF NOT EXISTS idx_bundles_bundle_id ON product_bundles(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundles_name ON product_bundles(name);
CREATE INDEX IF NOT EXISTS idx_bundles_created_by ON product_bundles(created_by);
CREATE INDEX IF NOT EXISTS idx_bundles_created_at ON product_bundles(created_at DESC);

-- ===== CREATE BUNDLE PRODUCTS JUNCTION TABLE =====
CREATE TABLE IF NOT EXISTS bundle_products (
    id SERIAL PRIMARY KEY,
    bundle_id INTEGER NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
    product_salesforce_id VARCHAR(255) NOT NULL,  -- References products.salesforce_id
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate products in same bundle
    CONSTRAINT unique_bundle_product UNIQUE (bundle_id, product_salesforce_id)
);

-- Create indexes for bundle_products
CREATE INDEX IF NOT EXISTS idx_bundle_products_bundle_id ON bundle_products(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_products_product_id ON bundle_products(product_salesforce_id);
CREATE INDEX IF NOT EXISTS idx_bundle_products_sort_order ON bundle_products(bundle_id, sort_order);

-- ===== TRIGGER FOR UPDATED_AT =====
DROP TRIGGER IF EXISTS update_product_bundles_updated_at ON product_bundles;
CREATE TRIGGER update_product_bundles_updated_at
    BEFORE UPDATE ON product_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===== UPDATE PAGES TABLE =====
-- Update product-catalogue page to be called 'Catalogue'
UPDATE pages 
SET display_name = 'Catalogue',
    description = 'Browse products and manage deployment bundles'
WHERE name = 'experimental.product-catalogue';

-- ===== SEQUENCE FOR BUNDLE IDs =====
-- Create sequence for generating sequential bundle IDs
CREATE SEQUENCE IF NOT EXISTS bundle_id_seq START 1;

-- ===== SUCCESS MESSAGE =====
DO $$
BEGIN
    RAISE NOTICE '✅ Product Bundles feature tables created successfully';
    RAISE NOTICE '📦 Tables: product_bundles, bundle_products';
    RAISE NOTICE '🔄 Updated page: experimental.product-catalogue → Catalogue';
END $$;





