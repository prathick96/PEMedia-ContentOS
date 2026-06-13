/**
 * lib/trends/sources.ts
 *
 * Free, keyless-first trend sources for the Scout Agent.
 *
 *   - Hacker News (Algolia API)   — no key, tech only
 *   - Reddit public JSON           — no key, just a descriptive User-Agent
 *   - YouTube Data API mostPopular — YOUTUBE_API_KEY (free, 1 quota unit/call)
 *
 * Each fetcher returns [] on failure — the Scout degrades gracefully to
 * model-only topic generation if every source is down.
 *
 * The raw JSON → RawTrendItem mappers are exported separately so they can be
 * unit-tested without network access.
 */

import type { NicheSlug } from "@/lib/db/schema";

export type TrendSource = "hackernews" | "reddit" | "youtube" | "wikipedia";

export interface RawTrendItem {
  title: string;
  url?: string;
  source: TrendSource;
  /** Upvotes / points / view count — only comparable within one source. */
  metric: number;
  metricLabel: string;
}

const FETCH_TIMEOUT_MS = 10_000;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
  return res.json();
}

// ── Hacker News ──────────────────────────────────────────────────────────────

interface HnHit {
  title?: string;
  url?: string;
  points?: number;
  objectID?: string;
}

export function mapHackerNews(json: unknown): RawTrendItem[] {
  const hits = (json as { hits?: HnHit[] })?.hits ?? [];
  return hits
    .filter((h) => typeof h.title === "string" && h.title.length > 0)
    .map((h) => ({
      title: h.title as string,
      url: h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : undefined),
      source: "hackernews" as const,
      metric: h.points ?? 0,
      metricLabel: "points",
    }));
}

export async function fetchHackerNews(limit = 20): Promise<RawTrendItem[]> {
  const json = await fetchJson(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`
  );
  return mapHackerNews(json);
}

// ── Reddit (public JSON, no OAuth) ───────────────────────────────────────────

interface RedditChild {
  data?: {
    title?: string;
    permalink?: string;
    ups?: number;
    stickied?: boolean;
    over_18?: boolean;
  };
}

export function mapReddit(json: unknown): RawTrendItem[] {
  const children = (json as { data?: { children?: RedditChild[] } })?.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter(
      (d): d is NonNullable<RedditChild["data"]> =>
        Boolean(d && typeof d.title === "string" && d.title.length > 0 && !d.stickied && !d.over_18)
    )
    .map((d) => ({
      title: d.title as string,
      url: d.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
      source: "reddit" as const,
      metric: d.ups ?? 0,
      metricLabel: "upvotes",
    }));
}

export async function fetchSubredditTop(subreddit: string, limit = 15): Promise<RawTrendItem[]> {
  const userAgent = process.env.REDDIT_USER_AGENT ?? "contentOS/1.0 (trend monitor)";
  const json = await fetchJson(
    `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=${limit}`,
    { "User-Agent": userAgent }
  );
  return mapReddit(json);
}

// ── YouTube Data API ─────────────────────────────────────────────────────────

interface YtVideoItem {
  snippet?: { title?: string };
  statistics?: { viewCount?: string };
  id?: string;
}

export function mapYouTube(json: unknown): RawTrendItem[] {
  const items = (json as { items?: YtVideoItem[] })?.items ?? [];
  return items
    .filter((v) => typeof v.snippet?.title === "string")
    .map((v) => ({
      title: v.snippet!.title as string,
      url: typeof v.id === "string" ? `https://www.youtube.com/watch?v=${v.id}` : undefined,
      source: "youtube" as const,
      metric: Number(v.statistics?.viewCount ?? 0),
      metricLabel: "views",
    }));
}

/** videos.list mostPopular costs 1 quota unit — safe at any daily cadence. */
export async function fetchYouTubeTrending(videoCategoryId?: string, limit = 15): Promise<RawTrendItem[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const category = videoCategoryId ? `&videoCategoryId=${videoCategoryId}` : "";
  const json = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=${limit}${category}&key=${key}`
  );
  return mapYouTube(json);
}

// ── Wikipedia trending pageviews (keyless, very reliable) ────────────────────

interface WikiArticle {
  article?: string;
  views?: number;
}

/** Internal/meta pages that always top the chart but carry no topic signal. */
const WIKI_NOISE = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Talk:|User:|Template:)/;

export function mapWikipedia(json: unknown): RawTrendItem[] {
  const articles =
    (json as { items?: { articles?: WikiArticle[] }[] })?.items?.[0]?.articles ?? [];
  return articles
    .filter(
      (a): a is Required<WikiArticle> =>
        typeof a.article === "string" && !WIKI_NOISE.test(a.article) && typeof a.views === "number"
    )
    .map((a) => ({
      title: a.article.replace(/_/g, " "),
      url: `https://en.wikipedia.org/wiki/${a.article}`,
      source: "wikipedia" as const,
      metric: a.views,
      metricLabel: "views",
    }));
}

/**
 * Most recent day of en.wikipedia top pageviews. The dataset lags 1–3 days
 * behind real time, so walk back until a loaded day is found.
 */
export async function fetchWikipediaTrending(limit = 25): Promise<RawTrendItem[]> {
  const userAgent = process.env.REDDIT_USER_AGENT ?? "contentOS/1.0 (trend monitor)";
  let lastError: unknown = null;
  for (const daysBack of [1, 2, 3]) {
    const d = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    try {
      const json = await fetchJson(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${yyyy}/${mm}/${dd}`,
        { "User-Agent": userAgent }
      );
      return mapWikipedia(json).slice(0, limit);
    } catch (err) {
      lastError = err; // 404 = day not loaded yet — try one further back
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Wikipedia pageviews unavailable");
}

// ── Per-niche source plan ────────────────────────────────────────────────────

/**
 * YouTube category ids: 28 Science&Tech · 1 Film&Animation · 17 Sports · 25 News&Politics.
 * History has no trending category — Reddit carries it.
 */
export const NICHE_SOURCE_PLAN: Record<
  NicheSlug,
  { hackerNews?: boolean; wikipedia?: boolean; subreddits: string[]; youtubeCategoryId?: string }
> = {
  tech: { hackerNews: true, subreddits: ["technology", "artificial"], youtubeCategoryId: "28" },
  history: { wikipedia: true, subreddits: ["history", "todayilearned"] },
  movies: { wikipedia: true, subreddits: ["movies", "boxoffice"], youtubeCategoryId: "1" },
  sports: { wikipedia: true, subreddits: ["sports"], youtubeCategoryId: "17" },
  news: { wikipedia: true, subreddits: ["worldnews"], youtubeCategoryId: "25" },
};
