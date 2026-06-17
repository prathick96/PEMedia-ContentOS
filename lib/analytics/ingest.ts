/**
 * lib/analytics/ingest.ts
 *
 * Pulls real YouTube numbers into analytics_snaps + video_analytics so the
 * Analytics and CEO agents act on actual performance, not an empty table.
 *
 * v1 uses the Data API (public stats: subscribers, views, likes, comments) — free
 * and covered by the youtube.readonly scope already granted. Watch-time, average
 * view %, CTR, and revenue need the YouTube Analytics API (deeper OAuth) and are
 * left at 0 for now (upgrade path).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMyChannel,
  fetchVideoStats,
  getValidAccessToken,
  type YouTubeChannelInfo,
  type YouTubeVideoStats,
} from "@/lib/youtube";

/** Today's date as YYYY-MM-DD (UTC). */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Pure: channel info → analytics_snaps row. */
export function toSnapshotRow(channelId: string, info: YouTubeChannelInfo, date: string) {
  return {
    channel_id: channelId,
    date,
    subscribers: info.subscribers,
    total_views: info.totalViews,
    watch_hours: 0,
    avg_view_duration_pct: 0,
    revenue_usd: 0,
  };
}

/** Pure: per-video stats → video_analytics row. */
export function toVideoAnalyticsRow(videoId: string, stats: YouTubeVideoStats, date: string) {
  return {
    video_id: videoId,
    date,
    views: stats.views,
    watch_time_mins: 0,
    avg_view_pct: 0,
    ctr: 0,
    likes: stats.likes,
    comments: stats.comments,
    revenue_usd: 0,
  };
}

export interface IngestResult {
  date: string;
  snapshot: boolean;
  videosUpdated: number;
}

/** Ingest a channel's latest stats for `date` (idempotent upserts). */
export async function ingestChannelAnalytics(
  db: SupabaseClient,
  channelId: string,
  date: string = todayUtc()
): Promise<IngestResult> {
  const accessToken = await getValidAccessToken(db, channelId);

  // Channel snapshot.
  const info = await fetchMyChannel(accessToken);
  await db
    .from("analytics_snaps")
    .upsert(toSnapshotRow(channelId, info, date), { onConflict: "channel_id,date" });

  // Per-video stats for this channel's published videos.
  const { data: series } = await db.from("series").select("id").eq("channel_id", channelId);
  const seriesIds = (series ?? []).map((s: { id: string }) => s.id);
  if (seriesIds.length === 0) return { date, snapshot: true, videosUpdated: 0 };

  const { data: videos } = await db
    .from("videos")
    .select("id, youtube_id")
    .in("series_id", seriesIds)
    .not("youtube_id", "is", null);

  const rows = (videos ?? []) as { id: string; youtube_id: string }[];
  if (rows.length === 0) return { date, snapshot: true, videosUpdated: 0 };

  const stats = await fetchVideoStats(accessToken, rows.map((v) => v.youtube_id));
  const byYtId = new Map(stats.map((s) => [s.id, s]));

  let videosUpdated = 0;
  for (const v of rows) {
    const s = byYtId.get(v.youtube_id);
    if (!s) continue;
    await db
      .from("video_analytics")
      .upsert(toVideoAnalyticsRow(v.id, s, date), { onConflict: "video_id,date" });
    videosUpdated++;
  }

  return { date, snapshot: true, videosUpdated };
}
