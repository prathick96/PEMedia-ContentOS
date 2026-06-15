-- ============================================================================
-- PEMedia ContentOS — DEV DATA RESET  ⚠️ DESTRUCTIVE
-- ============================================================================
-- Wipes all operational data so you can start a fresh channel from scratch.
-- PRESERVES the `niches` registry (seed data the Creative Agent needs).
--
-- This clears, among others, channel_oauth — so you WILL need to re-connect
-- YouTube to the new channel afterwards.
--
-- Run in: Supabase Dashboard → SQL Editor → Run. There is no undo.
-- Safe to run repeatedly. Only truncates tables that exist (migration-tolerant).
-- ============================================================================

do $$
declare
  t text;
  -- order doesn't matter (cascade), but listed leaf→root for readability
  tables text[] := array[
    'qa_review_results',
    'quality_gate_results',
    'video_analytics',
    'analytics_snaps',
    'revenue_entries',
    'approvals',
    'council_decisions',
    'agent_jobs',
    'trend_signals',
    'videos',
    'series',
    'channel_oauth',
    'channels'
  ];
begin
  foreach t in array tables loop
    if to_regclass(t) is not null then
      execute format('truncate table %I restart identity cascade', t);
      raise notice 'truncated %', t;
    end if;
  end loop;
end $$;

-- Sanity check — should show your niches preserved and everything else empty.
select 'niches' as table, count(*) from niches
union all select 'channels', count(*) from channels
union all select 'videos', count(*) from videos
union all select 'trend_signals', count(*) from trend_signals
union all select 'agent_jobs', count(*) from agent_jobs;
