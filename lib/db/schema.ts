export type NicheSlug = "tech" | "history" | "movies" | "sports" | "news";
export type Platform = "youtube" | "tiktok";
export type VideoStatus =
  | "IDEA" | "SCRIPT_PENDING" | "SCRIPT_DONE"
  | "VOICE_PENDING" | "VOICE_DONE"
  | "VIDEO_PENDING" | "VIDEO_DONE"
  | "THUMBNAIL_DONE" | "READY"
  | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export type AgentType = "ceo" | "scout" | "creative" | "production" | "publisher" | "analytics";
export type AgentJobStatus = "queued" | "running" | "completed" | "failed";
export type RevenueSource = "adsense" | "affiliate" | "sponsor" | "membership" | "product";

export interface Niche {
  id: string;
  name: string;
  slug: NicheSlug;
  cpm_min: number;
  cpm_max: number;
  risk_level: "none" | "low" | "medium" | "high" | "very_high";
  active: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  niche_id: string;
  name: string;
  tagline: string;
  platform: Platform;
  url: string | null;
  brand_doc: ChannelBrandDoc | null;
  status: "building" | "active" | "paused" | "terminated";
  created_by_agent: AgentType;
  created_at: string;
}

export interface ChannelBrandDoc {
  tagline: string;
  audience_persona: string;
  brand_voice: string;
  brand_colors: { primary: string; secondary: string; accent: string };
  thumbnail_style_guide: string;
  content_pillars: string[];
}

export interface Series {
  id: string;
  channel_id: string;
  name: string;
  description: string;
  format: "short" | "medium" | "long";
  episode_template: string;
  frequency: string;
  active: boolean;
  created_at: string;
}

export interface Video {
  id: string;
  series_id: string;
  topic: string;
  status: VideoStatus;
  script: VideoScript | null;
  voice_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  chapters: VideoChapter[] | null;
  youtube_id: string | null;
  tiktok_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface VideoScript {
  hook: string;
  sections: { title: string; content: string }[];
  cta: string;
  title_options: string[];
  description: string;
  tags: string[];
  chapters: VideoChapter[];
}

export interface VideoChapter {
  time: string;
  title: string;
}

export interface TrendSignal {
  id: string;
  niche_id: string;
  topic: string;
  /** Live sources (hackernews/reddit/youtube) or claude_analysis when model-generated. */
  source: "hackernews" | "reddit" | "youtube" | "claude_analysis" | "google_trends" | "rss";
  score: number;
  raw_data: Record<string, unknown>;
  captured_at: string;
  used_in_video_id: string | null;
}

export interface AgentJob {
  id: string;
  agent_type: AgentType;
  status: AgentJobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
  triggered_by: "ceo" | "manual" | "cron";
}

export interface AnalyticsSnapshot {
  id: string;
  channel_id: string;
  date: string;
  subscribers: number;
  total_views: number;
  watch_hours: number;
  avg_view_duration_pct: number;
  revenue_usd: number;
}

export interface VideoAnalytics {
  id: string;
  video_id: string;
  date: string;
  views: number;
  watch_time_mins: number;
  avg_view_pct: number;
  ctr: number;
  likes: number;
  comments: number;
  revenue_usd: number;
}

export interface RevenueEntry {
  id: string;
  channel_id: string;
  source: RevenueSource;
  amount_usd: number;
  date: string;
  notes: string | null;
  created_at: string;
}

// ── Council + approvals (migration 002) ──────────────────────
// Domain types for the approvals gate live in lib/approvals.ts; the council
// decision/verdict shapes live in lib/council/types.ts. These are the raw DB
// row types for the two new tables.

export type CouncilMode = "strategic" | "tactical";

export interface CouncilDecisionRow {
  id: string;
  /** 'strategic' for open convenes, or the gate kind for tactical gates. */
  kind: string;
  mode: CouncilMode;
  question: string;
  decision: string | null;
  approved: boolean | null;
  confidence: number;
  /** Full CouncilDecision | GateVerdict including all seat opinions. */
  payload: Record<string, unknown>;
  convened_at: string;
  created_at: string;
}

// ── Quality gate (migration 003) ─────────────────────────────

export interface QualityGateResultRow {
  id: string;
  topic: string;
  series_id: string | null;
  video_id: string | null;
  passed: boolean;
  /** Composite score 0–100. Pass threshold is 60. */
  score: number;
  /** Full QualityDimensions object from lib/quality-gate/types.ts */
  dimensions: Record<string, unknown>;
  reasons: string[];
  flags: string[];
  evaluated_at: string;
}
