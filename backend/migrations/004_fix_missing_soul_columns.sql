-- Add missing columns to souls table
-- Run this if some columns were not added by previous migrations

-- Add last_memory_consolidation_at if missing
ALTER TABLE souls ADD COLUMN IF NOT EXISTS last_memory_consolidation_at TIMESTAMP WITH TIME ZONE;

-- Add heartbeat_enabled if missing
ALTER TABLE souls ADD COLUMN IF NOT EXISTS heartbeat_enabled BOOLEAN DEFAULT true;

-- Verify all columns are now present
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'souls' 
  AND table_schema = 'public'
  AND column_name IN ('memory_enabled', 'memory_config', 'last_memory_consolidation_at', 'heartbeat_enabled')
ORDER BY column_name;
