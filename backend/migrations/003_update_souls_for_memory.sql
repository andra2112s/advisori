-- Add memory-related columns to souls table
ALTER TABLE souls ADD COLUMN IF NOT EXISTS memory_config JSONB DEFAULT '{
  "short_term_limit": 20,
  "long_term_importance_threshold": 5,
  "auto_consolidate": true,
  "retention_days": 365
}';

-- Add last_memory_consolidation timestamp
ALTER TABLE souls ADD COLUMN IF NOT EXISTS last_memory_consolidation_at TIMESTAMP WITH TIME ZONE;

-- Create memory_consolidation_logs table
CREATE TABLE IF NOT EXISTS memory_consolidation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_memories_consolidated INTEGER DEFAULT 0,
  long_term_memories_created INTEGER DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger to update updated_at on memories
CREATE OR REPLACE FUNCTION update_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memories_updated_at();

-- Create trigger to update updated_at on session_memories
CREATE TRIGGER session_memories_updated_at
  BEFORE UPDATE ON session_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memories_updated_at();

-- Function to clean expired session memories
CREATE OR REPLACE FUNCTION cleanup_expired_session_memories()
RETURNS void AS $$
BEGIN
  DELETE FROM session_memories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-session-memories', '0 */2 * * *', 'SELECT cleanup_expired_session_memories();');
