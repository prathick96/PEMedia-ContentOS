-- PEMedia ContentOS — Platform OAuth tokens
-- Migration 007: per-channel OAuth credentials so the Publisher can upload
-- autonomously (YouTube first). Backs lib/youtube.ts + /api/auth/youtube/*.
-- Apply via Supabase SQL Editor (after 001–006).
--
-- SECURITY: refresh_token is stored in plaintext — acceptable for local-only
-- Phase 1 (service-role only, no public deploy, RLS disabled). Encrypt at rest
-- (or move to a secrets manager) BEFORE any public deployment.

create table if not exists channel_oauth (
  id                    uuid primary key default gen_random_uuid(),
  channel_id            uuid not null references channels(id) on delete cascade,
  provider              text not null default 'youtube'
                          check (provider in ('youtube','tiktok','instagram','facebook')),
  refresh_token         text not null,
  access_token          text,
  token_expiry          timestamptz,
  scope                 text,
  -- the connected platform account identity (e.g. YouTube channel id + title)
  provider_account_id   text,
  provider_account_name text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (channel_id, provider)
);

create index if not exists idx_channel_oauth_channel on channel_oauth(channel_id);
