/**
 * lib/scheduling/cadence.ts
 *
 * Posting cadence guard. Enforces two hard rules (CLAUDE.md): never post within
 * 18h on the same channel, and (algorithm-friendly, sustainable) at most 2 posts
 * per rolling 7 days. The decision logic is pure + tested; checkChannelCadence
 * wraps it with a Supabase lookup. Enforced at public go-live (lib/publishing).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_HOURS_BETWEEN_POSTS = 18;
export const MAX_POSTS_PER_WEEK = 2;

const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

export interface CadenceDecision {
  allowed: boolean;
  reason?: string;
  /** When the next post would be permitted, if currently blocked (ISO). */
  nextAllowedAt?: string;
}

export interface CadenceOptions {
  minHoursBetween?: number;
  maxPerWeek?: number;
}

/**
 * Pure: given a channel's recent publish timestamps, may it post at `now`?
 * Blocks if the most recent post is < minHours old, or if there are already
 * maxPerWeek posts in the trailing 7 days.
 */
export function evaluateCadence(
  recentPublishedAt: Date[],
  now: Date = new Date(),
  opts: CadenceOptions = {}
): CadenceDecision {
  const minHours = opts.minHoursBetween ?? MIN_HOURS_BETWEEN_POSTS;
  const maxPerWeek = opts.maxPerWeek ?? MAX_POSTS_PER_WEEK;

  const times = recentPublishedAt
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime()); // newest first

  // 18-hour rule.
  if (times.length > 0) {
    const hoursSince = (now.getTime() - times[0].getTime()) / HOUR_MS;
    if (hoursSince < minHours) {
      return {
        allowed: false,
        reason: `Only ${hoursSince.toFixed(1)}h since the last post; ${minHours}h required between posts.`,
        nextAllowedAt: new Date(times[0].getTime() + minHours * HOUR_MS).toISOString(),
      };
    }
  }

  // Rolling 7-day cap.
  const windowStart = now.getTime() - WEEK_MS;
  const inWindow = times.filter((d) => d.getTime() >= windowStart);
  if (inWindow.length >= maxPerWeek) {
    const oldestInWindow = inWindow[inWindow.length - 1];
    return {
      allowed: false,
      reason: `${inWindow.length} posts in the last 7 days; max ${maxPerWeek}.`,
      nextAllowedAt: new Date(oldestInWindow.getTime() + WEEK_MS).toISOString(),
    };
  }

  return { allowed: true };
}

/** Load a channel's recent publish times and evaluate the cadence rules. */
export async function checkChannelCadence(
  db: SupabaseClient,
  channelId: string,
  now: Date = new Date(),
  opts: CadenceOptions = {}
): Promise<CadenceDecision> {
  const { data: series } = await db.from("series").select("id").eq("channel_id", channelId);
  const seriesIds = (series ?? []).map((s: { id: string }) => s.id);
  if (seriesIds.length === 0) return { allowed: true };

  const { data: videos } = await db
    .from("videos")
    .select("published_at")
    .in("series_id", seriesIds)
    .eq("status", "PUBLISHED")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(20);

  const times = (videos ?? [])
    .map((v: { published_at: string | null }) => (v.published_at ? new Date(v.published_at) : null))
    .filter((d): d is Date => d !== null);

  return evaluateCadence(times, now, opts);
}
