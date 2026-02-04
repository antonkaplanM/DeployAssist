-- ===================================================================
-- Migration: Add tenant_status column to current_accounts
-- This column tracks whether a tenant is Active or Deprovisioned in SML
-- ===================================================================

-- Add tenant_status column to track SML tenant status
-- Values: 'Active' (tenant exists in SML with isDeleted=false)
--         'Deprovisioned' (tenant exists in SML with isDeleted=true)
ALTER TABLE current_accounts 
ADD COLUMN IF NOT EXISTS tenant_status VARCHAR(50) DEFAULT 'Active';

-- Create index for filtering by tenant status
CREATE INDEX IF NOT EXISTS idx_current_accounts_tenant_status ON current_accounts(tenant_status);

-- Update comment
COMMENT ON COLUMN current_accounts.tenant_status IS 'SML tenant status: Active (isDeleted=false) or Deprovisioned (isDeleted=true)';

-- Set default for existing records
UPDATE current_accounts SET tenant_status = 'Active' WHERE tenant_status IS NULL;

COMMIT;
