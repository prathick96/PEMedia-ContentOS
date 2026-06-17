import type { ShortCut } from "@/lib/db/schema";

/**
 * Cross-platform distribution rules. Pure functions, no I/O — safe to use in
 * agents, API routes, and tests.
 *
 * The model: one production yields one long-form (16:9 → YouTube) and one
 * vertical short (9:16 → YouTube Shorts + Instagram Reels + TikTok + Facebook
 * Reels). The short is the distribution engine; the long-form is the product.
 *
 * Cross-promo: over-promoting the long-form on every short suppresses reach and
 * reads as spam. So only 1 in every CROSS_PROMO_EVERY shorts ends with a short
 * spoken CTA to the YouTube long-form; the rest are fully self-contained.
 */

/** Every Nth short carries the spoken CTA to the long-form. */
export const CROSS_PROMO_EVERY = 5;

/** Spoken-length budget for the cross-promo tail, in seconds. */
export const PROMO_TAIL_SECS = 5;

/** The vertical surfaces a single 9:16 file can be posted to. */
export type ShortSurface =
  | "youtube_shorts"
  | "instagram_reels"
  | "facebook_reels"
  | "tiktok";

export type LongSurface = "youtube";

/**
 * Default short fan-out. TikTok is intentionally excluded: it's banned in India
 * (where the operator is based) and its Content Posting API needs an app audit,
 * so it's deferred until the planned Canada relocation. Opt in per production via
 * buildDistributionPlan(crossPromote, { includeTikTok: true }).
 */
export const DEFAULT_SHORT_SURFACES: readonly ShortSurface[] = [
  "youtube_shorts",
  "instagram_reels",
  "facebook_reels",
] as const;

/** Every surface we know how to target, including opt-in ones (TikTok). */
export const ALL_SHORT_SURFACES: readonly ShortSurface[] = [
  ...DEFAULT_SHORT_SURFACES,
  "tiktok",
] as const;

/**
 * Decide whether the short at a given position in a channel's short sequence
 * carries the cross-promo tail. `priorShortCount` is the 0-based count of shorts
 * already produced for the channel, so the 1st short is `0` and the 5th is `4`.
 * Returns true once per window of CROSS_PROMO_EVERY (on the last slot).
 */
export function shouldCrossPromote(priorShortCount: number): boolean {
  if (!Number.isFinite(priorShortCount) || priorShortCount < 0) return false;
  return (priorShortCount + 1) % CROSS_PROMO_EVERY === 0;
}

/**
 * A platform-neutral spoken CTA driving short viewers to the long-form. The same
 * audio plays on all four surfaces, so it can't reference "below", "in bio", or
 * any one app's affordance — it names the channel and points to YouTube.
 */
export function composePromoTail(channelName: string): string {
  const name = channelName?.trim() || "our channel";
  return `Want the full breakdown? The complete video is on YouTube — search ${name}. Link in the description.`;
}

export interface ShortNarrationOptions {
  /** Whether this short is the 1-in-5 that cross-promotes the long-form. */
  crossPromote: boolean;
  /** Channel name, spoken in the promo tail. */
  channelName: string;
}

/**
 * Build the short's TTS-ready narration. When `crossPromote` is set, the 5s promo
 * tail is appended (blank-line separated). Prefers an existing `tts_narration` as
 * the base, else `narration`. Never mutates the input.
 */
export function buildShortNarration(short: ShortCut, opts: ShortNarrationOptions): string {
  const base = (short.tts_narration ?? short.narration ?? "").trim();
  if (!opts.crossPromote) return base;
  const tail = composePromoTail(opts.channelName);
  return base ? `${base}\n\n${tail}` : tail;
}

export interface DistributionPlan {
  longForm: { surface: LongSurface; aspect: "16:9"; ai_disclosure: true };
  short: {
    surfaces: ShortSurface[];
    aspect: "9:16";
    crossPromote: boolean;
    /** Synthetic voice + visuals → disclosure is mandatory on every surface. */
    ai_disclosure: true;
  };
}

export interface DistributionOptions {
  /** Include TikTok in the short fan-out. Deferred by default — see DEFAULT_SHORT_SURFACES. */
  includeTikTok?: boolean;
}

/** Build the per-production distribution plan. TikTok is opt-in (deferred). */
export function buildDistributionPlan(
  crossPromote: boolean,
  opts: DistributionOptions = {}
): DistributionPlan {
  const surfaces = opts.includeTikTok
    ? [...ALL_SHORT_SURFACES]
    : [...DEFAULT_SHORT_SURFACES];
  return {
    longForm: { surface: "youtube", aspect: "16:9", ai_disclosure: true },
    short: {
      surfaces,
      aspect: "9:16",
      crossPromote,
      ai_disclosure: true,
    },
  };
}
