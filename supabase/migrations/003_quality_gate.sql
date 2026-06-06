-- PEMedia ContentOS — Quality Gate Results
-- Migration 003: quality_gate_results audit table
-- Apply AFTER 001_initial.sql and 002_council.sql

-- ============================================================
-- QUALITY GATE RESULTS
-- ============================================================
-- Stores every gate evaluation for audit, dashboarding, and
-- model improvement. Even passed topics are persisted so we
-- can track score distributions over time.

create table quality_gate_results (
  id             uuid primary key default gen_random_uuid(),
  topic          text not null,
  series_id      uuid references series(id) on delete set null,
  video_id       uuid references videos(id) on delete set null,
  passed         boolean not null,
  score          numeric(5,2) not null check (score >= 0 and score <= 100),
  -- Full QualityDimensions object (originality, genuine_value, etc.)
  dimensions     jsonb not null default '{}',
  -- Human-readable reasons (array of strings)
  reasons        text[] not null default '{}',
  -- Machine-readable flags (e.g. "copyright_risk_high", "policy_violation")
  flags          text[] not null default '{}',
  evaluated_at   timestamptz not null default now()
);

create index idx_qgr_series   on quality_gate_results(series_id);
create index idx_qgr_passed   on quality_gate_results(passed);
create index idx_qgr_score    on quality_gate_results(score);
create index idx_qgr_eval_at  on quality_gate_results(evaluated_at desc);

-- ── Comments ──────────────────────────────────────────────────────────────────
comment on table quality_gate_results is
  'Audit log of every quality/originality gate evaluation. Populated by lib/quality-gate/index.ts before Production Agent script generation.';

comment on column quality_gate_results.score is
  'Composite score 0–100 from the weighted formula. Threshold to pass is 60.';

comment on column quality_gate_results.dimensions is
  'JSON object with originality, genuine_value, policy_compliance, ai_producibility, copyright_risk, duplicate_similarity scores plus reasoning and recommendations.';

comment on column quality_gate_results.flags is
  'Machine-readable failure flags: policy_violation, copyright_risk_high, not_ai_producible, duplicate_topic, score_below_threshold.';
