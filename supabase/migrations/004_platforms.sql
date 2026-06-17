-- PEMedia ContentOS — Multi-platform distribution
-- Migration 004: extend channels.platform beyond youtube/tiktok and add
-- per-platform post ids on videos.
-- Apply via: Supabase Dashboard > SQL Editor > Run (after 001–003)

-- ============================================================
-- CHANNELS: allow instagram + facebook
-- ============================================================
alter table channels drop constraint if exists channels_platform_check;
alter table channels add constraint channels_platform_check
  check (platform in ('youtube','tiktok','instagram','facebook'));

-- ============================================================
-- VIDEOS: per-platform post ids (youtube_id/tiktok_id already exist)
-- ============================================================
alter table videos add column if not exists instagram_id text;
alter table videos add column if not exists facebook_id text;

comment on column videos.instagram_id is 'Instagram Reel media id once cross-posted (Meta Graph API, Phase 3)';
comment on column videos.facebook_id  is 'Facebook Reel/post id once cross-posted (Meta Graph API, Phase 3)';
