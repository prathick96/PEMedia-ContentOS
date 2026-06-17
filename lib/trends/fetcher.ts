/**
 * lib/trends/fetcher.ts
 *
 * Aggregates the free trend sources for one niche, with per-source graceful
 * failure. The Scout Agent feeds the result into Claude for scoring; if every
 * source fails the Scout falls back to model-only generation and flags it.
 */

import type { NicheSlug } from "@/lib/db/schema";
import {
  NICHE_SOURCE_PLAN,
  fetchHackerNews,
  fetchSubredditTop,
  fetchWikipediaTrending,
  fetchYouTubeTrending,
  type RawTrendItem,
} from "./sources";

export interface NicheSignals {
  niche: NicheSlug;
  items: RawTrendItem[];
  sourcesOk: string[];
  sourcesFailed: string[];
}

const MAX_ITEMS_PER_NICHE = 40;

export async function fetchRawSignals(niche: NicheSlug): Promise<NicheSignals> {
  const plan = NICHE_SOURCE_PLAN[niche];
  const tasks: { name: string; promise: Promise<RawTrendItem[]> }[] = [];

  if (plan.hackerNews) {
    tasks.push({ name: "hackernews", promise: fetchHackerNews() });
  }
  if (plan.wikipedia) {
    tasks.push({ name: "wikipedia", promise: fetchWikipediaTrending() });
  }
  for (const sub of plan.subreddits) {
    tasks.push({ name: `reddit:r/${sub}`, promise: fetchSubredditTop(sub) });
  }
  if (plan.youtubeCategoryId || process.env.YOUTUBE_API_KEY) {
    tasks.push({ name: "youtube", promise: fetchYouTubeTrending(plan.youtubeCategoryId) });
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));

  const items: RawTrendItem[] = [];
  const sourcesOk: string[] = [];
  const sourcesFailed: string[] = [];

  settled.forEach((result, i) => {
    const name = tasks[i].name;
    if (result.status === "fulfilled" && result.value.length > 0) {
      sourcesOk.push(name);
      items.push(...result.value);
    } else {
      sourcesFailed.push(name);
      if (result.status === "rejected") {
        console.warn(`[trends] ${name} failed for ${niche}:`, result.reason?.message ?? result.reason);
      }
    }
  });

  // Strongest signals first within each source, then interleave by rank so one
  // high-volume source doesn't drown out the others.
  const bySource = new Map<string, RawTrendItem[]>();
  for (const item of items) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source)!.push(item);
  }
  for (const list of bySource.values()) list.sort((a, b) => b.metric - a.metric);

  const interleaved: RawTrendItem[] = [];
  const lists = [...bySource.values()];
  for (let rank = 0; interleaved.length < Math.min(items.length, MAX_ITEMS_PER_NICHE); rank++) {
    let pushed = false;
    for (const list of lists) {
      if (rank < list.length && interleaved.length < MAX_ITEMS_PER_NICHE) {
        interleaved.push(list[rank]);
        pushed = true;
      }
    }
    if (!pushed) break;
  }

  return { niche, items: interleaved, sourcesOk, sourcesFailed };
}
