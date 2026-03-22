-- Create heartbeat configurations table
CREATE TABLE IF NOT EXISTS heartbeat_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier VARCHAR(50) NOT NULL UNIQUE CHECK (tier IN ('free', 'pro', 'premium')),
  interval_minutes INTEGER NOT NULL DEFAULT 1440, -- Default: 24 hours
  max_daily_proactive INTEGER NOT NULL DEFAULT 1,
  message_templates JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default heartbeat configurations
INSERT INTO heartbeat_configs (tier, interval_minutes, max_daily_proactive, message_templates) VALUES
('free', 1440, 1, '[
  "Hai {{soul_name}}! Ada yang bisa aku bantu hari ini?",
  "Senang berjumpa lagi! Apa kabarmu?",
  "Aku di sini untukmu. Ada yang ingin dibicarakan?"
]'),
('pro', 480, 5, '[
  "Hai {{soul_name}}! Sudah lama tidak ngobrol. Ada kabar terbaru?",
  "Selamat {{time_of_day}}! Semoga harimu menyenangkan ya!",
  "Aku ingat kita pernah bicara tentang {{last_topic}}. Bagaimana perkembangannya?",
  "Ada yang menarik hari ini? Ceritain dong!",
  "Jangan lupa jaga kesehatan ya! Ada yang bisa aku bantu?"
]'),
('premium', 60, -1, '[
  "Hai {{soul_name}}! Aku selalu di sini untukmu 🌟",
  "Selamat {{time_of_day}}! Semangat menjalani hari ya!",
  "Aku perhatikan kamu belum aktif sebentar. Semoga baik-baik saja!",
  "Ada mimpi atau target baru yang ingin dicapai? Aku dukung kamu!",
  "Ingat {{user_preference}}? Mungkin ini saat yang tepat untuk itu!",
  "Cuaca hari ini {{weather}}, jangan lupa {{weather_advice}}!",
  "Aku menyimpan kenangan kita: {{recent_memory}}. Mau lanjut?",
  "Kamu adalah {{compliment}}! Teruslah bersinar ✨"
]')
ON CONFLICT (tier) DO UPDATE SET
  interval_minutes = EXCLUDED.interval_minutes,
  max_daily_proactive = EXCLUDED.max_daily_proactive,
  message_templates = EXCLUDED.message_templates;

-- Create heartbeat_logs table to track sent messages
CREATE TABLE IF NOT EXISTS heartbeat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('web', 'telegram', 'whatsapp')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_received_at TIMESTAMP WITH TIME ZONE,
  responded BOOLEAN DEFAULT false
);

-- Create indexes for heartbeat logs
CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_user_id ON heartbeat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_sent_at ON heartbeat_logs(sent_at DESC);

-- Create user_heartbeat_preferences table
CREATE TABLE IF NOT EXISTS user_heartbeat_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT true,
  custom_interval_minutes INTEGER,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
  preferred_channels JSONB DEFAULT '["web"]',
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  daily_count INTEGER DEFAULT 0,
  reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add heartbeat_enabled flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS heartbeat_enabled BOOLEAN DEFAULT true;
