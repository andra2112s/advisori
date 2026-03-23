-- User Skills table for modular skill system
-- Run this in Supabase SQL Editor

-- User skills (installed skills per user)
CREATE TABLE IF NOT EXISTS user_skills (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  PRIMARY KEY (user_id, skill_id)
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills(skill_id);

-- Enable RLS
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own skills"
  ON user_skills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can install skills"
  ON user_skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can uninstall skills"
  ON user_skills FOR DELETE
  USING (auth.uid() = user_id);

-- Seed default skills for new users (will be inserted on user creation via trigger)
CREATE OR REPLACE FUNCTION seed_default_skills()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert free skills for new users
  INSERT INTO user_skills (user_id, skill_id)
  SELECT NEW.id, skill_id FROM skills WHERE tier = 'free'
  ON CONFLICT (user_id, skill_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE user_skills IS 'Tracks installed skills per user for modular skill system';
