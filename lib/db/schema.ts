export type NicheSlug = "tech" | "history" | "movies" | "sports" | "news";
/** A channel's home surface. Migration 004 extended this beyond youtube/tiktok. */
export type Platform = "youtube" | "tiktok" | "instagram" | "facebook";
export type VideoStatus =
  | "IDEA" | "SCRIPT_PENDING" | "SCRIPT_DONE"
  | "VOICE_PENDING" | "VOICE_DONE"
  | "VIDEO_PENDING" | "VIDEO_DONE"
  | "THUMBNAIL_DONE" | "READY"
  | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export type AgentType =
  | "ceo" | "scout" | "creative" | "production" | "qa" | "publisher" | "analytics";
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

/**
 * Forgeable brand voice: explicit DOs/DON'Ts + an example sentence written in
 * the voice, so a script writer (or the Production Agent) can reproduce it.
 */
export interface BrandVoice {
  dos: string[];
  donts: string[];
  example_sentence: string;
}

export interface ChannelBrandDoc {
  tagline: string;
  audience_persona: string;
  /** Structured in current brand docs; legacy rows may store a plain string. */
  brand_voice: string | BrandVoice;
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
  /** Instagram Reel media id once cross-posted (migration 004). */
  instagram_id: string | null;
  /** Facebook Reel/post id once cross-posted (migration 004). */
  facebook_id: string | null;
  /** True for the vertical 9:16 derivative cut (migration 005). */
  is_short: boolean;
  /** For a short, the long-form video it was cut from (migration 005). */
  parent_video_id: string | null;
  /** For a short, whether it carries the 5s end CTA to the YouTube long-form (1-in-5 rule). */
  cross_promo_youtube: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

/**
 * One section of a script package. All fields beyond title/content are
 * optional so legacy rows (plain { title, content } sections) still typecheck.
 */
export interface VideoScriptSection {
  title: string;
  /** Legacy field — always mirrors `narration` in new packages so old consumers keep working. */
  content: string;
  /** Voice-ready prose: exactly what gets pasted into ElevenLabs. No markdown, no stage directions. */
  narration?: string;
  duration_target_secs?: number;
  /** HOW to source visuals for this section: screen recording of X / AI image / stock b-roll. */
  visual_direction?: string;
  /** Concrete search terms for Pexels/Pixabay stock footage. */
  broll_keywords?: string[];
  /** 1–2 detailed, style-consistent cinematic prompts usable in any AI image/video generator (16:9). */
  ai_image_prompts?: string[];
  /** Optional text overlay displayed on screen during this section. */
  on_screen_text?: string;
}

/** ElevenLabs delivery guidance for the whole script package. */
export interface VoiceDirection {
  style: string;
  pace: string;
  elevenlabs_settings: { stability: number; similarity_boost: number };
  per_section_notes?: string[];
}

/** Everything needed to brief a thumbnail, including a ready-to-use AI prompt. */
export interface ThumbnailConcept {
  composition: string;
  /** Overlay text — 4 words max. */
  text: string;
  style_notes: string;
  ai_image_prompt: string;
}

/**
 * The vertical 9:16 derivative cut from the long-form. Same production, posted
 * to YouTube Shorts + Instagram Reels + TikTok + Facebook Reels. Self-contained:
 * the hook lands in the first second and the payoff doesn't require the long-form.
 * Every 5th short (the 1-in-5 rule) appends a 5-second CTA to the YouTube long-form —
 * see lib/agents/distribution.ts.
 */
export interface ShortCut {
  /** 0–1s scroll-stopping opener; must work with sound off (captions burned in). */
  hook: string;
  /** Voice-ready narration for the 30–45s cut — no markdown, no stage directions. */
  narration: string;
  /**
   * Full TTS-ready string actually sent to ElevenLabs, including the 5s cross-promo
   * tail when this short is the 1-in-5. Mirrors `narration` when no tail applies.
   */
  tts_narration?: string;
  /** Burned-in caption / on-screen-text beats, in order. */
  captions?: string[];
  duration_target_secs?: number;
  /** HOW to source vertical visuals (reframed long-form b-roll, AI 9:16 still, etc.). */
  visual_direction?: string;
  broll_keywords?: string[];
  /** 1–2 cinematic prompts for AI image/video generators, composed for 9:16. */
  ai_image_prompts?: string[];
  /** Platform-neutral end CTA. Never "subscribe below" — the file posts to four apps. */
  cta?: string;
}

export interface VideoScript {
  hook: string;
  sections: VideoScriptSection[];
  cta: string;
  title_options: string[];
  description: string;
  tags: string[];
  chapters: VideoChapter[];
  /** Full hook → sections → CTA narration as one TTS-ready string (blank-line separated). */
  tts_narration?: string;
  voice_direction?: VoiceDirection;
  thumbnail_concept?: ThumbnailConcept;
  /** The vertical 9:16 cut derived from this long-form, for cross-platform distribution. */
  short_cut?: ShortCut;
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

// ── Platform OAuth (migration 007) ───────────────────────────

export interface ChannelOAuthRow {
  id: string;
  channel_id: string;
  provider: Platform;
  refresh_token: string;
  access_token: string | null;
  token_expiry: string | null;
  scope: string | null;
  /** Connected platform account identity (e.g. YouTube channel id + title). */
  provider_account_id: string | null;
  provider_account_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── QA review (migration 006) ────────────────────────────────

export interface QAReviewResultRow {
  id: string;
  video_id: string | null;
  series_id: string | null;
  topic: string;
  /** 'auto_publish' | 'needs_human_review' | 'reject'. */
  decision: string;
  /** Composite 0–100. */
  score: number;
  /** Full QADimensions from lib/qa-review/types.ts. */
  dimensions: Record<string, unknown>;
  reasons: string[];
  flags: string[];
  evaluated_at: string;
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
