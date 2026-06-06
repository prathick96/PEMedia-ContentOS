-- PEMedia ContentOS — Council + Approvals
-- Apply via: Supabase Dashboard > SQL Editor > Run (after 001_initial.sql)
-- Backs lib/council/* and lib/approvals.ts (see docs/strategy/council-brief-001.md)

-- ============================================================
-- COUNCIL DECISIONS  (audit log of every convene / gate)
-- ============================================================
create table council_decisions (
  id          uuid primary key default gen_random_uuid(),
  -- 'strategic' for open convenes; gate kind for tactical gates
  kind        text not null,
  mode        text not null check (mode in ('strategic','tactical')),
  question    text not null,
  -- chairman decision text (strategic) or rationale (tactical)
  decision    text,
  -- tactical gates only: true/false/null
  approved    boolean,
  confidence  numeric(4,3) not null default 0,
  -- full structured CouncilDecision | GateVerdict, including all seat opinions
  payload     jsonb not null default '{}',
  convened_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_council_kind on council_decisions(kind);
create index idx_council_mode on council_decisions(mode);
create index idx_council_convened on council_decisions(convened_at desc);

-- ============================================================
-- APPROVALS  (human-in-the-loop gate for high-stakes actions)
-- ============================================================
create table approvals (
  id              uuid primary key default gen_random_uuid(),
  action          text not null check (action in ('launch_channel','publish_video','schedule_video','spend_money')),
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  payload         jsonb not null default '{}',
  -- optional council verdict surfaced to the operator at decision time
  council_verdict jsonb,
  -- optional pointer back to the entity awaiting sign-off (e.g. 'video', <uuid>)
  entity_type     text,
  entity_id       uuid,
  note            text,
  requested_by    text not null default 'system',
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index idx_approvals_status on approvals(status);
create index idx_approvals_action on approvals(action);
create index idx_approvals_pending on approvals(created_at) where status = 'pending';
create index idx_approvals_entity on approvals(entity_type, entity_id);
