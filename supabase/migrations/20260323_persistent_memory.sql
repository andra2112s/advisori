-- Persistent Memory via pgvector
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory vectors table
CREATE TABLE IF NOT EXISTS memory_vectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  memory_type TEXT DEFAULT 'semantic' CHECK (memory_type IN ('episodic', 'semantic', 'working')),
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding ON memory_vectors USING ivfflat (embedding vector_cosine_ops);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_memory_vectors_user_id ON memory_vectors(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_vectors_type ON memory_vectors(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_vectors_expires ON memory_vectors(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE memory_vectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own memories"
  ON memory_vectors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON memory_vectors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON memory_vectors FOR DELETE
  USING (auth.uid() = user_id);

-- Function to clean up expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS void AS $$
BEGIN
  DELETE FROM memory_vectors 
  WHERE expires_at IS NOT NULL 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Cron job to clean expired memories (run daily)
-- SELECT cron.schedule('cleanup-memories', '0 0 * * *', 'SELECT cleanup_expired_memories()');

-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  id uuid,
  content text,
  memory_type text,
  importance integer,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mv.id,
    mv.content,
    mv.memory_type,
    mv.importance,
    mv.created_at,
    1 - (mv.embedding <=> query_embedding) as similarity
  FROM memory_vectors mv
  WHERE mv.user_id = match_memories.user_id
    AND mv.memory_type != 'working'
    AND (mv.expires_at IS NULL OR mv.expires_at > NOW())
    AND 1 - (mv.embedding <=> query_embedding) > match_threshold
  ORDER BY mv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comments
COMMENT ON TABLE memory_vectors IS 'Stores user memories with vector embeddings for semantic search';
COMMENT ON COLUMN memory_vectors.memory_type IS 'Type: working (RAM), episodic (short-term), semantic (long-term)';
COMMENT ON COLUMN memory_vectors.importance IS 'Importance score 1-10, higher = more important';