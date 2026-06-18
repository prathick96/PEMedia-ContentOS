-- PEMedia ContentOS — Pipeline Runs (reload-survival persistence)
-- Migration 008: pipeline_runs is the single source of truth for a full pipeline
-- run's lifecycle, so a browser reload no longer loses an in-flight run. The
-- background executor (lib/pipeline/execute.ts) inserts one row per run and rewrites
-- `stages` as each stage transition lands; the Pipeline page rehydrates from this
-- table on mount and polls it while a run is active. Apply via Supabase SQL Editor
-- (after 001–007).

create table if not exists pipeline_runs (
  id            uuid primary key default gen_random_uuid(),
  niche         text not null,
  -- running | completed | failed | awaiting_approval (terminal: all but 'running')
  status        text not null default 'running'
                check (status in ('running','completed','failed','awaiting_approval')),
  current_stage text,
  -- ordered array of PipelineEvent (lib/pipeline/stages.ts): status + small pointers
  -- only, never full scripts/blobs (free-tier discipline)
  stages        jsonb not null default '[]'::jsonb,
  video_id      uuid references videos(id) on delete set null,
  output_path   text,
  error         text,
  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_pipeline_runs_started on pipeline_runs(started_at desc);
create index if not exists idx_pipeline_runs_status  on pipeline_runs(status);

comment on table pipeline_runs is
  'Source of truth for a full pipeline run lifecycle. The Pipeline UI rehydrates and polls this table instead of holding run state in the browser, so reloads do not lose a running pipeline. Written by lib/pipeline/execute.ts; a stale running row (no updated_at change in 30 min) is reaped to failed.';
