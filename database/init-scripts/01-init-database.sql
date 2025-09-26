-- Database initialization script for Deployment Assistant
-- This script runs when PostgreSQL container starts for the first time

-- Ensure the database and user exist (should be created by environment variables)
-- Additional setup if needed

-- Grant all privileges to app_user on public schema
GRANT ALL ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log initialization
SELECT 'Database initialized successfully for Deployment Assistant' AS status;
