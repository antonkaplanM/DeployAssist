-- Expand all new product columns to TEXT type for safety
-- Some products have very long values

ALTER TABLE products 
ALTER COLUMN country TYPE TEXT,
ALTER COLUMN ri_platform_region TYPE TEXT,
ALTER COLUMN ri_platform_sub_region TYPE TEXT,
ALTER COLUMN model_type TYPE TEXT,
ALTER COLUMN model_subtype TYPE TEXT,
ALTER COLUMN peril TYPE TEXT,
ALTER COLUMN data_type TYPE TEXT;

-- Log the fix
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_new_fields_expanded_to_text', 
    'system', 
    NULL, 
    '{"columns": ["country", "ri_platform_region", "ri_platform_sub_region", "model_type", "model_subtype", "peril", "data_type"], "new_type": "TEXT"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ All new product columns expanded to TEXT type';
END $$;

