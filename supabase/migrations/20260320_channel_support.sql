-- Migration: Add multi-channel support (WhatsApp, Telegram, Discord)
-- Created: 2026-03-20

-- Channel connections (per user)
CREATE TABLE IF NOT EXISTS channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'discord')),
  connected BOOLEAN DEFAULT FALSE,
  credentials JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel)
);

-- Channel sessions (per conversation)
CREATE TABLE IF NOT EXISTS channel_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  channel_chat_id TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel, channel_chat_id)
);

-- Channel messages (history)
CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES channel_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_connections_user_id ON channel_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_connections_channel ON channel_connections(channel);
CREATE INDEX IF NOT EXISTS idx_channel_sessions_user_id ON channel_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_sessions_channel ON channel_sessions(channel);
CREATE INDEX IF NOT EXISTS idx_channel_sessions_last_message ON channel_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_session_id ON channel_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created_at ON channel_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channel_connections
CREATE POLICY "Users can manage own channel connections"
  ON channel_connections FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for channel_sessions
CREATE POLICY "Users can view own channel sessions"
  ON channel_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channel sessions"
  ON channel_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channel sessions"
  ON channel_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for channel_messages
CREATE POLICY "Users can view own channel messages"
  ON channel_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM channel_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own channel messages"
  ON channel_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM channel_sessions WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for channel_connections
CREATE TRIGGER update_channel_connections_updated_at
  BEFORE UPDATE ON channel_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE channel_connections IS 'Stores user connections to messaging channels (WhatsApp, Telegram, Discord)';
COMMENT ON TABLE channel_sessions IS 'Stores individual chat sessions per channel per user';
COMMENT ON TABLE channel_messages IS 'Stores message history for each channel session';
