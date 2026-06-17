/**
 * lib/db/queries.ts
 *
 * Server-side read layer for the dashboard. Every page reads through these
 * helpers; none of them are safe to import from client components (they use
 * the service-role client because RLS blocks the anon key).
 *
 * Resilience contract: each helper catches its own errors and returns an
 * empty fallback so a missing/unreachable database degrades the dashboard
 * to its empty states instead of crashing the page.
 */

import { getServerClient } from "./client";
import type {
  AgentJob,
  AgentType,
  Channel,
  Niche,
  RevenueEntry,
  Series,
  TrendSignal,
  Video,
} from "./schema";
import type { Approval } from "@/lib/approvals";

const AGENT_TYPES: AgentType[] = ["ceo", "scout", "creative", "production", "qa", "publisher", "analytics"];

async function safe<T>(fallback: T, label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[queries] ${label} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

// ── Overview ─────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalChannels: number;
  activeChannels: number;
  publishedVideos: number;
  totalVideos: number;
  monthRevenueUsd: number;
  allTimeRevenueUsd: number;
  totalSubscribers: number;
  pendingApprovals: number;
}

const EMPTY_STATS: OverviewStats = {
  totalChannels: 0,
  activeChannels: 0,
  publishedVideos: 0,
  totalVideos: 0,
  monthRevenueUsd: 0,
  allTimeRevenueUsd: 0,
  totalSubscribers: 0,
  pendingApprovals: 0,
};

export async function getOverviewStats(): Promise<OverviewStats> {
  return safe(EMPTY_STATS, "getOverviewStats", async () => {
    const db = getServerClient();

    const [channels, activeChannels, published, totalVideos, revenue, snaps, approvals] =
      await Promise.all([
        db.from("channels").select("id", { count: "exact", head: true }),
        db.from("channels").select("id", { count: "exact", head: true }).eq("status", "active"),
        db.from("videos").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED"),
        db.from("videos").select("id", { count: "exact", head: true }),
        db.from("revenue_entries").select("amount_usd, date"),
        db.from("analytics_snaps").select("channel_id, date, subscribers").order("date", { ascending: false }).limit(200),
        db.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthRevenueUsd = 0;
    let allTimeRevenueUsd = 0;
    for (const r of (revenue.data ?? []) as { amount_usd: number; date: string }[]) {
      const amount = Number(r.amount_usd) || 0;
      allTimeRevenueUsd += amount;
      if (new Date(r.date) >= monthStart) monthRevenueUsd += amount;
    }

    // Latest snapshot per channel → summed subscribers
    const latestPerChannel = new Map<string, number>();
    for (const s of (snaps.data ?? []) as { channel_id: string; subscribers: number }[]) {
      if (!latestPerChannel.has(s.channel_id)) latestPerChannel.set(s.channel_id, s.subscribers);
    }
    const totalSubscribers = [...latestPerChannel.values()].reduce((a, b) => a + b, 0);

    return {
      totalChannels: channels.count ?? 0,
      activeChannels: activeChannels.count ?? 0,
      publishedVideos: published.count ?? 0,
      totalVideos: totalVideos.count ?? 0,
      monthRevenueUsd,
      allTimeRevenueUsd,
      totalSubscribers,
      pendingApprovals: approvals.count ?? 0,
    };
  });
}

// ── Agents ───────────────────────────────────────────────────────────────────

export interface AgentStatus {
  agent: AgentType;
  lastJob: AgentJob | null;
}

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  const fallback = AGENT_TYPES.map((agent) => ({ agent, lastJob: null }));
  return safe(fallback, "getAgentStatuses", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("agent_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(60);

    const latest = new Map<AgentType, AgentJob>();
    for (const job of (data ?? []) as AgentJob[]) {
      if (!latest.has(job.agent_type)) latest.set(job.agent_type, job);
    }
    return AGENT_TYPES.map((agent) => ({ agent, lastJob: latest.get(agent) ?? null }));
  });
}

export async function getRecentJobs(limit = 25): Promise<AgentJob[]> {
  return safe([], "getRecentJobs", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("agent_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as AgentJob[];
  });
}

// ── Pipeline / videos ────────────────────────────────────────────────────────

export interface VideoWithContext extends Video {
  series: (Pick<Series, "id" | "name" | "format"> & {
    channels: Pick<Channel, "id" | "name"> | null;
  }) | null;
}

export async function getPipelineVideos(): Promise<VideoWithContext[]> {
  return safe([], "getPipelineVideos", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("videos")
      .select("*, series(id, name, format, channels(id, name))")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as unknown as VideoWithContext[];
  });
}

// ── Trends ───────────────────────────────────────────────────────────────────

export interface TrendSignalWithNiche extends TrendSignal {
  niches: Pick<Niche, "name" | "slug"> | null;
}

export interface NicheTrendGroup {
  nicheName: string;
  nicheSlug: string;
  signals: TrendSignalWithNiche[];
}

export async function getTrendSignalsByNiche(limit = 120): Promise<NicheTrendGroup[]> {
  return safe([], "getTrendSignalsByNiche", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("trend_signals")
      .select("*, niches(name, slug)")
      .order("captured_at", { ascending: false })
      .limit(limit);

    const groups = new Map<string, NicheTrendGroup>();
    for (const signal of (data ?? []) as unknown as TrendSignalWithNiche[]) {
      const slug = signal.niches?.slug ?? "unknown";
      if (!groups.has(slug)) {
        groups.set(slug, {
          nicheName: signal.niches?.name ?? "Unknown",
          nicheSlug: slug,
          signals: [],
        });
      }
      groups.get(slug)!.signals.push(signal);
    }
    // Highest-scoring first within each niche
    for (const g of groups.values()) {
      g.signals.sort((a, b) => Number(b.score) - Number(a.score));
    }
    return [...groups.values()];
  });
}

// ── Channels / series ────────────────────────────────────────────────────────

export interface ChannelWithRelations extends Channel {
  niches: Pick<Niche, "name" | "slug"> | null;
  series: Series[];
}

export async function getChannels(): Promise<ChannelWithRelations[]> {
  return safe([], "getChannels", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("channels")
      .select("*, niches(name, slug), series(*)")
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as ChannelWithRelations[];
  });
}

export async function getChannelById(id: string): Promise<ChannelWithRelations | null> {
  return safe(null, "getChannelById", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("channels")
      .select("*, niches(name, slug), series(*)")
      .eq("id", id)
      .single();
    return data as unknown as ChannelWithRelations | null;
  });
}

export interface SeriesWithRelations extends Series {
  channels: (Pick<Channel, "id" | "name" | "tagline"> & {
    niches: Pick<Niche, "name" | "slug"> | null;
  }) | null;
  videos: Video[];
}

export async function getSeriesById(id: string): Promise<SeriesWithRelations | null> {
  return safe(null, "getSeriesById", async () => {
    const db = getServerClient();
    const [{ data: series }, { data: videos }] = await Promise.all([
      db.from("series").select("*, channels(id, name, tagline, niches(name, slug))").eq("id", id).single(),
      db.from("videos").select("*").eq("series_id", id).order("created_at", { ascending: false }),
    ]);
    if (!series) return null;
    return { ...(series as object), videos: (videos ?? []) as Video[] } as SeriesWithRelations;
  });
}

// ── Approvals ────────────────────────────────────────────────────────────────

export async function getPendingApprovals(): Promise<Approval[]> {
  return safe([], "getPendingApprovals", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("approvals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return (data ?? []) as Approval[];
  });
}

export async function getResolvedApprovals(limit = 20): Promise<Approval[]> {
  return safe([], "getResolvedApprovals", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("approvals")
      .select("*")
      .neq("status", "pending")
      .order("resolved_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Approval[];
  });
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export interface RevenueEntryWithChannel extends RevenueEntry {
  channels: Pick<Channel, "name"> | null;
}

export interface RevenueSummary {
  entries: RevenueEntryWithChannel[];
  thisMonthUsd: number;
  allTimeUsd: number;
  bySource: { source: string; totalUsd: number }[];
  byMonth: { month: string; totalUsd: number }[];
}

const EMPTY_REVENUE: RevenueSummary = {
  entries: [],
  thisMonthUsd: 0,
  allTimeUsd: 0,
  bySource: [],
  byMonth: [],
};

export async function getRevenueSummary(): Promise<RevenueSummary> {
  return safe(EMPTY_REVENUE, "getRevenueSummary", async () => {
    const db = getServerClient();
    const { data } = await db
      .from("revenue_entries")
      .select("*, channels(name)")
      .order("date", { ascending: false })
      .limit(500);

    const entries = (data ?? []) as unknown as RevenueEntryWithChannel[];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let thisMonthUsd = 0;
    let allTimeUsd = 0;
    const bySource = new Map<string, number>();
    const byMonth = new Map<string, number>();

    for (const e of entries) {
      const amount = Number(e.amount_usd) || 0;
      allTimeUsd += amount;
      if (new Date(e.date) >= monthStart) thisMonthUsd += amount;
      bySource.set(e.source, (bySource.get(e.source) ?? 0) + amount);
      const monthKey = e.date.slice(0, 7); // YYYY-MM
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + amount);
    }

    return {
      entries,
      thisMonthUsd,
      allTimeUsd,
      bySource: [...bySource.entries()].map(([source, totalUsd]) => ({ source, totalUsd })),
      byMonth: [...byMonth.entries()]
        .map(([month, totalUsd]) => ({ month, totalUsd }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  });
}

// ── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleData {
  scheduled: VideoWithContext[];
  publishedThisMonth: VideoWithContext[];
}

export async function getScheduleData(): Promise<ScheduleData> {
  return safe({ scheduled: [], publishedThisMonth: [] }, "getScheduleData", async () => {
    const db = getServerClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: scheduled }, { data: published }] = await Promise.all([
      db
        .from("videos")
        .select("*, series(id, name, format, channels(id, name))")
        .eq("status", "SCHEDULED")
        .order("scheduled_at", { ascending: true }),
      db
        .from("videos")
        .select("*, series(id, name, format, channels(id, name))")
        .eq("status", "PUBLISHED")
        .gte("published_at", monthStart)
        .order("published_at", { ascending: false }),
    ]);

    return {
      scheduled: (scheduled ?? []) as unknown as VideoWithContext[],
      publishedThisMonth: (published ?? []) as unknown as VideoWithContext[],
    };
  });
}

// ── Niches / settings ────────────────────────────────────────────────────────

export async function getNiches(): Promise<Niche[]> {
  return safe([], "getNiches", async () => {
    const db = getServerClient();
    const { data } = await db.from("niches").select("*").order("cpm_max", { ascending: false });
    return (data ?? []) as Niche[];
  });
}

/** Which env keys are configured — booleans only, never values. */
export interface EnvKeyHealth {
  key: string;
  set: boolean;
}

export function getEnvHealth(keys: string[]): EnvKeyHealth[] {
  return keys.map((key) => ({ key, set: Boolean(process.env[key]?.trim()) }));
}

/** True when the Supabase server credentials are present. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
