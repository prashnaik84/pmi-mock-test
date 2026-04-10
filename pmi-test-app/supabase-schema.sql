-- ============================================================
-- PMI Mock Test Platform — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── test_sessions ────────────────────────────────────────────
-- One row per paid test. Created by webhook on payment success.
create table if not exists test_sessions (
  id                   uuid primary key default uuid_generate_v4(),
  stripe_session_id    text unique not null,
  email                text not null,
  status               text not null default 'paid'
                         check (status in ('paid','questions_ready','in_progress','completed','expired')),
  total_questions      int  not null default 20,
  score                int,           -- 0–100 percentage
  correct_answers      int,
  time_taken_seconds   int,
  passed               boolean,
  domain_results       jsonb,         -- DomainResult[]
  detailed_results     jsonb,         -- full per-question breakdown (server only)
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);

-- Index for fast lookup by Stripe session ID (used after payment redirect)
create index if not exists idx_test_sessions_stripe on test_sessions (stripe_session_id);
create index if not exists idx_test_sessions_email  on test_sessions (email);

-- ── test_questions ───────────────────────────────────────────
-- One row per question per session. Stores correct answer server-side.
create table if not exists test_questions (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references test_sessions(id) on delete cascade,
  position     int  not null,          -- 0–19, order of questions
  q            text not null,
  options      jsonb not null,         -- string[]
  answer       int  not null,          -- 0–3 index of correct option
  explanation  text not null,
  domain       text not null,
  difficulty   text not null default 'medium'
                 check (difficulty in ('easy','medium','hard')),
  created_at   timestamptz not null default now(),
  unique(session_id, position)
);

create index if not exists idx_test_questions_session on test_questions (session_id);

-- ── Row Level Security ────────────────────────────────────────
-- Service role (backend) can do everything.
-- Anon role cannot read answers or detailed results from these tables.
-- The API routes use supabaseAdmin (service role) only.

alter table test_sessions  enable row level security;
alter table test_questions enable row level security;

-- Block all anon access (all reads/writes go through API routes with service role)
create policy "deny_anon_sessions"  on test_sessions  for all to anon using (false);
create policy "deny_anon_questions" on test_questions for all to anon using (false);

-- ── Analytics view (optional) ─────────────────────────────────
-- Useful for Supabase Dashboard / Metabase reporting
create or replace view test_analytics as
select
  date_trunc('day', created_at) as day,
  count(*)                       as tests_paid,
  count(*) filter (where status = 'completed') as tests_completed,
  count(*) filter (where passed = true)        as tests_passed,
  round(avg(score) filter (where status = 'completed'), 1) as avg_score,
  round(avg(time_taken_seconds) filter (where status = 'completed') / 60.0, 1) as avg_minutes
from test_sessions
group by 1
order by 1 desc;
