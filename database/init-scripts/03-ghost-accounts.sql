-- Ghost Accounts Database Schema
-- Tracks accounts with all products expired but not deprovisioned

-- Main ghost accounts tracking table
CREATE TABLE IF NOT EXISTS ghost_accounts (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL UNIQUE,
    account_name VARCHAR(255) NOT NULL,
    total_expired_products INT NOT NULL,
    latest_expiry_date DATE NOT NULL,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghost_accounts_account_id ON ghost_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_ghost_accounts_is_reviewed ON ghost_accounts(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_ghost_accounts_latest_expiry ON ghost_accounts(latest_expiry_date);
CREATE INDEX IF NOT EXISTS idx_ghost_accounts_last_checked ON ghost_accounts(last_checked DESC);

-- Add comments for documentation
COMMENT ON TABLE ghost_accounts IS 'Tracks accounts with all products expired but no deprovisioning PS record';
COMMENT ON COLUMN ghost_accounts.account_id IS 'Salesforce Account ID';
COMMENT ON COLUMN ghost_accounts.is_reviewed IS 'TRUE if an administrator has reviewed this ghost account';
COMMENT ON COLUMN ghost_accounts.latest_expiry_date IS 'The most recent expiration date among all expired entitlements';
COMMENT ON COLUMN ghost_accounts.last_checked IS 'When this account was last analyzed for ghost status';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ghost_accounts TO your_app_user;

COMMIT;

