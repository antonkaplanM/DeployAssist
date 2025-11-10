-- Fix Data API Name column length
-- Some Data_API_Name values are longer than 255 characters

ALTER TABLE products 
ALTER COLUMN data_api_name TYPE TEXT;

-- Log the fix
INSERT INTO auth_audit_log (action, entity_type, entity_id, new_value, created_at)
VALUES (
    'products_data_api_name_field_expanded', 
    'system', 
    NULL, 
    '{"column": "data_api_name", "old_type": "VARCHAR(500)", "new_type": "TEXT"}'::jsonb, 
    CURRENT_TIMESTAMP
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ data_api_name column expanded to TEXT type';
END $$;

