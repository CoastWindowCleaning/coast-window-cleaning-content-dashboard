-- Coast Window Cleaning Content Dashboard -- Supabase schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- for a fresh project. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- Whole-dashboard JSONB blob. This mirrors what used to be server/data-store.json:
-- settings, reels, agents, ideasBacklog, competitors, usage, followerHistory,
-- instagramAccountInsights, monthlyReports. Single row, id = 'default'.
create table if not exists dashboard_state (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Queued/trial reels for the upload -> AI scan -> schedule flow. Kept as a
-- real table (not inside the JSONB blob) because the scheduler needs to
-- efficiently query "what's due right now" and advance in-progress publishes
-- across separate cron ticks.
create table if not exists scheduled_reels (
  id bigint generated always as identity primary key,
  video_url text not null,
  source_filename text,
  caption text not null default '',
  hashtags text not null default '',
  description text not null default '',
  scheduled_for timestamptz,              -- null only for legacy rows; trial posts use "now"
  is_trial boolean not null default false,
  status text not null default 'queued'
    check (status in ('queued','publishing','posted','failed','canceled')),
  ig_creation_id text,                     -- IG media container id while publishing
  ig_media_id text,
  ig_permalink text,
  error_message text,
  ai_cost_usd numeric,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create index if not exists scheduled_reels_due_idx
  on scheduled_reels (status, scheduled_for);

-- Dashboard login accounts. Exactly two seeded via server/seedUsers.js --
-- never insert plaintext passwords here, only bcrypt hashes.
create table if not exists users (
  id bigint generated always as identity primary key,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('owner','admin')),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row Level Security: locked down. This server only ever connects with the
-- service_role key (which bypasses RLS by design), never the anon/public key,
-- so these tables should never be reachable directly from a browser.
alter table dashboard_state enable row level security;
alter table scheduled_reels enable row level security;
alter table users enable row level security;
