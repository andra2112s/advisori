-- ═══════════════════════════════════════════════════════
-- Advisori v2 — Schema Update
-- Jalankan di Supabase SQL Editor (tambahan dari schema sebelumnya)
-- ═══════════════════════════════════════════════════════

-- ── Bot connections per user ──────────────────────────
-- Setiap user bisa connect bot Telegram dan/atau WhatsApp mereka sendiri
create table if not exists bot_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  platform        text not null check (platform in ('telegram', 'whatsapp')),

  -- Telegram specific
  bot_token       text,                    -- encrypted di aplikasi sebelum disimpan
  bot_username    text,                    -- @ZaraBot
  bot_name        text,                    -- "Zara by Advisori"

  -- WhatsApp specific
  wa_session_id   text,                    -- unique session ID per user
  wa_phone        text,                    -- nomor WA yang di-pair
  wa_session_data jsonb,                   -- Baileys session data (encrypted)

  -- Status
  status          text default 'pending'
                    check (status in ('pending','active','error','disconnected')),
  error_message   text,
  last_active     timestamptz,

  -- Branding per user
  display_name    text,                    -- nama yang ditampilkan di bot
  welcome_message text,                    -- pesan sambutan custom

  connected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, platform)
);

-- Index untuk lookup cepat saat bot menerima pesan
create index if not exists bot_conn_token_idx
  on bot_connections (bot_token) where platform = 'telegram';
create index if not exists bot_conn_wa_idx
  on bot_connections (wa_session_id) where platform = 'whatsapp';

-- ── Paperclip agent registry ───────────────────────────
-- Setiap user punya "company" di Paperclip
-- Setiap skill aktif = satu agent dalam company tersebut
create table if not exists paperclip_agents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  skill_id        text not null references skills(id),

  -- Paperclip agent config
  agent_role      text not null,           -- "Pajak Advisor", "Saham Analyst"
  agent_goal      text not null,           -- tujuan agent ini
  budget_monthly  integer default 50000,   -- budget dalam rupiah/bulan
  budget_used     integer default 0,
  budget_period   text default 'monthly',

  -- State management
  state           jsonb default '{}',      -- persistent state antar heartbeat
  last_heartbeat  timestamptz,
  heartbeat_count integer default 0,

  is_active       boolean default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, skill_id)
);

-- ── Paperclip task queue ───────────────────────────────
-- Tasks yang dijadwalkan oleh Paperclip untuk dieksekusi agent
create table if not exists agent_tasks (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references paperclip_agents(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,

  task_type       text not null,           -- 'heartbeat', 'scheduled', 'triggered'
  task_name       text not null,           -- 'morning_briefing', 'market_alert', dll
  payload         jsonb default '{}',

  -- Atomic checkout (hanya satu worker yang proses)
  checked_out_at  timestamptz,
  checked_out_by  text,                    -- worker ID

  status          text default 'pending'
                    check (status in ('pending','processing','done','failed')),
  result          jsonb,
  error           text,

  scheduled_for   timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists tasks_pending_idx
  on agent_tasks (scheduled_for, status)
  where status = 'pending';

-- ── MiroFish prediction cache ──────────────────────────
-- Cache hasil swarm prediction untuk efisiensi
create table if not exists swarm_predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  query           text not null,           -- "BBCA outlook Q2 2025"
  query_hash      text not null,           -- hash untuk cache lookup
  persona_count   integer not null,        -- berapa agent yang digunakan
  predictions     jsonb not null,          -- array hasil tiap agent
  consensus       text not null,           -- hasil konsensus akhir
  confidence      numeric(3,2),            -- 0.00 - 1.00
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '6 hours'
);

create index if not exists predictions_hash_idx
  on swarm_predictions (query_hash, user_id);

-- ── RLS untuk tabel baru ───────────────────────────────
alter table bot_connections   enable row level security;
alter table paperclip_agents  enable row level security;
alter table agent_tasks       enable row level security;
alter table swarm_predictions enable row level security;

create policy "bot_conn_owner"   on bot_connections   for all using (auth.uid()::text = user_id::text);
create policy "agents_owner"     on paperclip_agents  for all using (auth.uid()::text = user_id::text);
create policy "tasks_owner"      on agent_tasks       for all using (auth.uid()::text = user_id::text);
create policy "predictions_owner" on swarm_predictions for all using (auth.uid()::text = user_id::text);
