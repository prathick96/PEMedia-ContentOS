-- PEMedia ContentOS — Vertical shorts as first-class distribution rows
-- Migration 005: a long-form video and its 9:16 short are tracked as separate
-- `videos` rows linked by parent_video_id. The short reuses the existing
-- per-platform id columns (youtube_id = YT Shorts, tiktok_id, instagram_id,
-- facebook_id = the four reel surfaces). cross_promo_youtube marks the 1-in-5
-- short that ends with a 5s CTA to the long-form (see lib/agents/distribution.ts).
-- Apply via: Supabase Dashboard > SQL Editor > Run (after 001–004)

alter table videos add column if not exists is_short boolean not null default false;
alter table videos add column if not exists parent_video_id uuid references videos(id) on delete set null;
alter table videos add column if not exists cross_promo_youtube boolean not null default false;

create index if not exists idx_videos_parent on videos(parent_video_id);
create index if not exists idx_videos_is_short on videos(is_short) where is_short;

comment on column videos.is_short is 'True for the vertical 9:16 derivative cut (YT Shorts / IG Reels / TikTok / FB Reels)';
comment on column videos.parent_video_id is 'For a short, the long-form video it was cut from';
comment on column videos.cross_promo_youtube is 'For a short, whether it ends with the 5s CTA to the YouTube long-form (1-in-5 rule)';
