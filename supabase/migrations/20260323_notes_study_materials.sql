-- Notes and Study Materials for Advisori
-- Inspired by Coconote

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'voice', 'image', 'chat')),
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  times_reviewed INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_note_id ON flashcards(note_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_note_id ON quizzes(note_id);

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes
CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for flashcards
CREATE POLICY "Users can manage own flashcards"
  ON flashcards FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for quizzes
CREATE POLICY "Users can manage own quizzes"
  ON quizzes FOR ALL
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE notes IS 'User notes - manual, voice, or from images';
COMMENT ON TABLE flashcards IS 'AI-generated flashcards from notes';
COMMENT ON TABLE quizzes IS 'AI-generated quizzes from notes';
