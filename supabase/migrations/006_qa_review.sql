-- PEMedia ContentOS — QA Reviewer
-- Migration 006: register the 'qa' agent type and add the QA review audit table.
-- The QA Reviewer scores a FINISHED package (script + visuals + thumbnail +
-- metadata + short) and gates advancement to the Publisher. Backs lib/qa-review/*
-- and lib/agents/qa-reviewer.ts. Apply via Supabase SQL Editor (after 001–005).

-- ============================================================
-- AGENT_JOBS: allow the new 'qa' agent type
-- ============================================================
alter table agent_jobs drop constraint if exists agent_jobs_agent_type_check;
alter table agent_jobs add constraint agent_jobs_agent_type_check
  check (agent_type in ('ceo','scout','creative','production','qa','publisher','analytics'));

-- ============================================================
-- QA REVIEW RESULTS  (audit log of every finished-package review)
-- ============================================================
create table if not exists qa_review_results (
  id           uuid primary key default gen_random_uuid(),
  video_id     uuid references videos(id) on delete cascade,
  series_id    uuid references series(id) on delete set null,
  topic        text not null,
  -- 'auto_publish' | 'needs_human_review' | 'reject'
  decision     text not null check (decision in ('auto_publish','needs_human_review','reject')),
  -- composite 0–100
  score        numeric(5,2) not null default 0,
  -- full QADimensions object from lib/qa-review/types.ts
  dimensions   jsonb not null default '{}',
  reasons      text[] not null default '{}',
  flags        text[] not null default '{}',
  evaluated_at timestamptz not null default now()
);

create index if not exists idx_qa_results_video on qa_review_results(video_id);
create index if not exists idx_qa_results_decision on qa_review_results(decision);
create index if not exists idx_qa_results_evaluated on qa_review_results(evaluated_at desc);
