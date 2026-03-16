-- ═══════════════════════════════════════════════════
-- Advisori — Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text,
  name          text not null,
  tier          text not null default 'free'
                  check (tier in ('free','pro','premium')),
  platform      text,          -- 'telegram' | 'whatsapp' | 'web'
  platform_id   text,          -- telegram chat_id atau wa number
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index untuk platform login
create unique index if not exists users_platform_idx
  on users (platform, platform_id)
  where platform is not null;

-- ── Souls (AI Personal per user) ─────────────────────
create table if not exists souls (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  name           text not null default 'Aria',
  personality    text not null default 'warm, direct, intelligent',
  speaking_style text not null default 'conversational bahasa Indonesia',
  backstory      text,
  values         text[] default array['kejujuran','kejelasan','kepraktisan'],
  quirks         text[] default array[]::text[],
  avatar         text default '✦',
  language       text default 'id' check (language in ('id','en','mix')),
  memory         jsonb default '{"episodic":[],"semantic":{},"preferences":{}}'::jsonb,
  is_setup       boolean default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id)
);

-- ── Messages (chat history per user per advisor) ──────
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  advisor_id  text not null,   -- 'advisori-pajak' | 'advisori-saham' | dll
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Index untuk query history cepat
create index if not exists messages_user_advisor_idx
  on messages (user_id, advisor_id, created_at desc);

-- Index untuk rate limit check (count per user per hari)
create index if not exists messages_user_date_idx
  on messages (user_id, created_at)
  where role = 'user';

-- ── Skills (catalog) ─────────────────────────────────
create table if not exists skills (
  id            text primary key,   -- 'advisori-pajak'
  name          text not null,
  description   text,
  emoji         text default '✦',
  category      text not null,
  tier          text not null default 'free'
                  check (tier in ('free','pro','premium')),
  price         integer default 0,  -- dalam rupiah/bulan, 0 = gratis
  author_id     uuid references users(id),
  status        text default 'active'
                  check (status in ('draft','review','active','rejected')),
  downloads     integer default 0,
  created_at    timestamptz not null default now()
);

-- Seed official skills
insert into skills (id, name, emoji, category, tier, price, status) values
  ('advisori-pajak',  'Konsultan Pajak Indonesia', '🧾', 'keuangan', 'free',    0,     'active'),
  ('advisori-saham',  'Analis Saham IDX',          '📈', 'keuangan', 'free',    0,     'active'),
  ('advisori-hukum',  'Konsultan Hukum Bisnis',    '⚖️', 'hukum',    'pro',     49000, 'active'),
  ('advisori-properti','Konsultan Properti',       '🏠', 'properti', 'pro',     49000, 'draft'),
  ('advisori-karir',  'Career Advisor',            '💼', 'karir',    'pro',     29000, 'draft'),
  ('advisori-crypto', 'Crypto & Aset Digital',     '₿',  'keuangan', 'pro',     49000, 'draft')
on conflict (id) do nothing;

-- ── Subscriptions (user → skill) ─────────────────────
create table if not exists subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  skill_id    text not null references skills(id),
  status      text not null default 'active'
                check (status in ('active','cancelled','expired')),
  started_at  timestamptz not null default now(),
  expires_at  timestamptz,
  unique (user_id, skill_id)
);

-- ── Payments ──────────────────────────────────────────
create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  skill_id        text references skills(id),
  amount          integer not null,  -- rupiah
  status          text default 'pending'
                    check (status in ('pending','paid','failed','refunded')),
  midtrans_order  text unique,
  midtrans_token  text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- ── Revenue splits (untuk skill marketplace) ─────────
create table if not exists revenue_splits (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references payments(id),
  author_id     uuid references users(id),
  platform_cut  integer not null,   -- 30% ke Advisori
  author_cut    integer,            -- 70% ke developer skill
  created_at    timestamptz not null default now()
);

-- ── RLS Policies ─────────────────────────────────────
-- User hanya bisa akses data miliknya sendiri

alter table users         enable row level security;
alter table souls         enable row level security;
alter table messages      enable row level security;
alter table subscriptions enable row level security;
alter table payments      enable row level security;

-- Users: hanya bisa lihat diri sendiri
create policy "users_self" on users
  for all using (auth.uid()::text = id::text);

-- Souls: hanya owner
create policy "souls_owner" on souls
  for all using (auth.uid()::text = user_id::text);

-- Messages: hanya owner
create policy "messages_owner" on messages
  for all using (auth.uid()::text = user_id::text);

-- Subscriptions: hanya owner (read), service role (write)
create policy "subs_owner_read" on subscriptions
  for select using (auth.uid()::text = user_id::text);

-- Skills: semua bisa baca yang active
create policy "skills_public_read" on skills
  for select using (status = 'active');
