-- Check if all memory and heartbeat migrations have been applied
-- Run this in Supabase SQL Editor to verify

-- Check memories table
SELECT 'memories table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'memories' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check session_memories table
SELECT 'session_memories table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'session_memories' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check heartbeat_configs table
SELECT 'heartbeat_configs table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'heartbeat_configs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check heartbeat_logs table
SELECT 'heartbeat_logs table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'heartbeat_logs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check user_heartbeat_preferences table
SELECT 'user_heartbeat_preferences table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_heartbeat_preferences' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check memory_consolidation_logs table
SELECT 'memory_consolidation_logs table' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'memory_consolidation_logs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if souls table has new columns
SELECT 'souls table new columns' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'souls' 
  AND table_schema = 'public'
  AND column_name IN ('memory_config', 'last_memory_consolidation_at', 'memory_enabled', 'heartbeat_enabled')
ORDER BY column_name;

-- Check indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN (
  'memories', 
  'session_memories', 
  'heartbeat_logs', 
  'memory_consolidation_logs',
  'user_heartbeat_preferences'
) AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Check triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('memories_updated_at', 'session_memories_updated_at');

-- Check functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_memories_updated_at', 'cleanup_expired_session_memories');

-- Sample data check (optional)
-- Uncomment to see if tables have data
-- SELECT 'memories' as table_name, COUNT(*) as row_count FROM memories
-- UNION ALL
-- SELECT 'session_memories', COUNT(*) FROM session_memories
-- UNION ALL
-- SELECT 'heartbeat_configs', COUNT(*) FROM heartbeat_configs
-- UNION ALL
-- SELECT 'heartbeat_logs', COUNT(*) FROM heartbeat_logs
-- UNION ALL
-- SELECT 'user_heartbeat_preferences', COUNT(*) FROM user_heartbeat_preferences
-- UNION ALL
-- SELECT 'memory_consolidation_logs', COUNT(*) FROM memory_consolidation_logs;
