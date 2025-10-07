-- ===================================================================
-- All Accounts Table - Stores all unique accounts from Salesforce
-- ===================================================================

CREATE TABLE IF NOT EXISTS all_accounts (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) UNIQUE NOT NULL,  -- Account__c from Salesforce (account name)
    account_name VARCHAR(255) NOT NULL,        -- Display name (same as account_id in most cases)
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_ps_records INT DEFAULT 0,
    latest_ps_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_all_accounts_account_id ON all_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_all_accounts_last_synced ON all_accounts(last_synced DESC);
CREATE INDEX IF NOT EXISTS idx_all_accounts_account_name ON all_accounts(account_name);

COMMENT ON TABLE all_accounts IS 'All unique accounts found in Salesforce Prof_Services_Request__c records';
COMMENT ON COLUMN all_accounts.account_id IS 'Account__c field from Salesforce (the account name string)';
COMMENT ON COLUMN all_accounts.last_synced IS 'Last time this account was synced from Salesforce';
COMMENT ON COLUMN all_accounts.total_ps_records IS 'Total number of PS records for this account';

