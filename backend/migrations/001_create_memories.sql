-- Create memories table for long-term memory storage
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('preference', 'event', 'relationship', 'goal', 'insight', 'learning')),
  title VARCHAR(255),
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 10),
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- Create session_memories table for short-term memory
CREATE TABLE IF NOT EXISTS session_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  context JSONB DEFAULT '{}',
  summary TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for session memories
CREATE INDEX IF NOT EXISTS idx_session_memories_session_id ON session_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_session_memories_user_id ON session_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_session_memories_expires_at ON session_memories(expires_at);

-- Add memory_enabled flag to souls table
ALTER TABLE souls ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true;
