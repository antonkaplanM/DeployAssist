-- =====================================================
-- MCP Tool Invocations Audit Trail
-- =====================================================
-- Tracks all MCP tool invocations for security and monitoring
-- Created: October 24, 2025

-- Create table for MCP tool invocations
CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(255),  -- Denormalized for audit trail
  tool_name VARCHAR(255) NOT NULL,
  arguments JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  error_code VARCHAR(100),
  execution_time_ms INTEGER,
  api_calls INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_user ON mcp_tool_invocations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_tool ON mcp_tool_invocations(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_created ON mcp_tool_invocations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_success ON mcp_tool_invocations(success, created_at DESC);

-- Create view for recent invocations with user details
CREATE OR REPLACE VIEW mcp_recent_invocations AS
SELECT 
  i.id,
  i.tool_name,
  i.username,
  u.email as user_email,
  r.name as user_role,
  i.success,
  i.error_code,
  i.execution_time_ms,
  i.created_at
FROM mcp_tool_invocations i
LEFT JOIN users u ON i.user_id = u.id
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY i.created_at DESC
LIMIT 100;

-- Create view for tool usage statistics
CREATE OR REPLACE VIEW mcp_tool_stats AS
SELECT 
  tool_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = true) as successful_calls,
  COUNT(*) FILTER (WHERE success = false) as failed_calls,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_time_ms,
  MAX(created_at) as last_used_at
FROM mcp_tool_invocations
GROUP BY tool_name
ORDER BY total_calls DESC;

-- Create view for user activity
CREATE OR REPLACE VIEW mcp_user_activity AS
SELECT 
  i.username,
  u.email,
  COUNT(*) as total_invocations,
  COUNT(DISTINCT i.tool_name) as unique_tools_used,
  MAX(i.created_at) as last_activity_at,
  COUNT(*) FILTER (WHERE i.created_at > NOW() - INTERVAL '1 hour') as calls_last_hour,
  COUNT(*) FILTER (WHERE i.created_at > NOW() - INTERVAL '1 day') as calls_last_day
FROM mcp_tool_invocations i
LEFT JOIN users u ON i.user_id = u.id
GROUP BY i.username, u.email
ORDER BY total_invocations DESC;

-- Function to cleanup old audit records (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_mcp_invocations()
RETURNS void AS $$
BEGIN
  DELETE FROM mcp_tool_invocations
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON mcp_recent_invocations TO PUBLIC;
GRANT SELECT ON mcp_tool_stats TO PUBLIC;
GRANT SELECT ON mcp_user_activity TO PUBLIC;

COMMENT ON TABLE mcp_tool_invocations IS 'Audit trail for all MCP tool invocations';
COMMENT ON COLUMN mcp_tool_invocations.arguments IS 'JSON of input arguments (sensitive data should be redacted)';
COMMENT ON COLUMN mcp_tool_invocations.execution_time_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN mcp_tool_invocations.api_calls IS 'Number of internal API calls made';

-- Insert a test record (optional, for verification)
-- This will be replaced by actual usage data
INSERT INTO mcp_tool_invocations 
  (tool_name, username, arguments, success, execution_time_ms, created_at)
VALUES 
  ('system_test', 'system', '{"test": true}'::jsonb, true, 0, NOW())
ON CONFLICT DO NOTHING;

-- Success messages
DO $$
BEGIN
  RAISE NOTICE 'MCP audit logging tables created successfully';
  RAISE NOTICE 'Views created: mcp_recent_invocations, mcp_tool_stats, mcp_user_activity';
  RAISE NOTICE 'Cleanup function: cleanup_old_mcp_invocations() - run periodically to maintain 90-day retention';
END $$;

