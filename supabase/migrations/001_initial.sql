-- PEMedia ContentOS — Initial Schema
-- Apply via: Supabase Dashboard > SQL Editor > Run

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- NICHES
-- ============================================================
create table niches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  cpm_min     numeric(6,2) not null default 2,
  cpm_max     numeric(6,2) not null default 8,
  risk_level  text not null check (risk_level in ('none','low','medium','high','very_high')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into niches (name, slug, cpm_min, cpm_max, risk_level, active) values
  ('Tech',          'tech',    8,  15, 'low',      true),
  ('World History', 'history', 4,   8, 'none',     true),
  ('Movies',        'movies',  4,   8, 'medium',   false),
  ('Sports',        'sports',  3,   6, 'high',     false),
  ('Current News',  'news',    2,   5, 'very_high',false);

-- ============================================================
-- CHANNELS
-- ============================================================
create table channels (
  id                uuid primary key default gen_random_uuid(),
  niche_id          uuid not null references niches(id),
  name              text not null,
  tagline           text,
  platform          text not null check (platform in ('youtube','tiktok')),
  url               text,
  brand_doc         jsonb,
  status            text not null default 'building' check (status in ('building','active','paused','terminated')),
  created_by_agent  text not null default 'creative',
  created_at        timestamptz not null default now()
);

create index idx_channels_niche on channels(niche_id);
create index idx_channels_status on channels(status);

-- ============================================================
-- SERIES
-- ============================================================
create table series (
  id               uuid primary key default gen_random_uuid(),
  channel_id       uuid not null references channels(id) on delete cascade,
  name             text not null,
  description      text,
  format           text not null check (format in ('short','medium','long')),
  episode_template text,
  frequency        text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index idx_series_channel on series(channel_id);

-- ============================================================
-- VIDEOS
-- ============================================================
create type video_status as enum (
  'IDEA','SCRIPT_PENDING','SCRIPT_DONE',
  'VOICE_PENDING','VOICE_DONE',
  'VIDEO_PENDING','VIDEO_DONE',
  'THUMBNAIL_DONE','READY',
  'SCHEDULED','PUBLISHED','ARCHIVED'
);

create table videos (
  id            uuid primary key default gen_random_uuid(),
  series_id     uuid not null references series(id) on delete cascade,
  topic         text not null,
  status        video_status not null default 'IDEA',
  script        jsonb,
  voice_url     text,
  video_url     text,
  thumbnail_url text,
  title         text,
  description   text,
  tags          text[] not null default '{}',
  chapters      jsonb,
  youtube_id    text,
  tiktok_id     text,
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_videos_series on videos(series_id);
create index idx_videos_status on videos(status);

-- ============================================================
-- TREND SIGNALS
-- ============================================================
create table trend_signals (
  id               uuid primary key default gen_random_uuid(),
  niche_id         uuid not null references niches(id),
  topic            text not null,
  source           text not null,
  score            numeric(5,2) not null default 0,
  raw_data         jsonb not null default '{}',
  captured_at      timestamptz not null default now(),
  used_in_video_id uuid references videos(id)
);

create index idx_trends_niche on trend_signals(niche_id);
create index idx_trends_score on trend_signals(score desc);
create index idx_trends_unused on trend_signals(used_in_video_id) where used_in_video_id is null;

-- ============================================================
-- AGENT JOBS
-- ============================================================
create table agent_jobs (
  id           uuid primary key default gen_random_uuid(),
  agent_type   text not null check (agent_type in ('ceo','scout','creative','production','publisher','analytics')),
  status       text not null default 'queued' check (status in ('queued','running','completed','failed')),
  input        jsonb not null default '{}',
  output       jsonb,
  started_at   timestamptz,
  completed_at timestamptz,
  duration_ms  integer,
  error        text,
  triggered_by text not null default 'manual' check (triggered_by in ('ceo','manual','cron'))
);

create index idx_jobs_agent on agent_jobs(agent_type);
create index idx_jobs_status on agent_jobs(status);
create index idx_jobs_started on agent_jobs(started_at desc);

-- ============================================================
-- ANALYTICS
-- ============================================================
create table analytics_snaps (
  id                    uuid primary key default gen_random_uuid(),
  channel_id            uuid not null references channels(id) on delete cascade,
  date                  date not null,
  subscribers           integer not null default 0,
  total_views           bigint not null default 0,
  watch_hours           numeric(10,2) not null default 0,
  avg_view_duration_pct numeric(5,2) not null default 0,
  revenue_usd           numeric(10,2) not null default 0,
  unique (channel_id, date)
);

create table video_analytics (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references videos(id) on delete cascade,
  date            date not null,
  views           integer not null default 0,
  watch_time_mins numeric(10,2) not null default 0,
  avg_view_pct    numeric(5,2) not null default 0,
  ctr             numeric(5,4) not null default 0,
  likes           integer not null default 0,
  comments        integer not null default 0,
  revenue_usd     numeric(10,2) not null default 0,
  unique (video_id, date)
);

-- ============================================================
-- REVENUE
-- ============================================================
create table revenue_entries (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id),
  source     text not null check (source in ('adsense','affiliate','sponsor','membership','product')),
  amount_usd numeric(10,2) not null,
  date       date not null,
  notes      text,
  created_at timestamptz not null default now()
);

create index idx_revenue_channel on revenue_entries(channel_id);
create index idx_revenue_date on revenue_entries(date desc);

-- ============================================================
-- ROW LEVEL SECURITY (enable for production)
-- ============================================================
-- alter table niches enable row level security;
-- alter table channels enable row level security;
-- alter table series enable row level security;
-- alter table videos enable row level security;
-- (Add policies after auth is configured in Phase 1)
