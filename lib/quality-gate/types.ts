/**
 * lib/quality-gate/types.ts
 *
 * Types for the quality / originality gate that guards the Production Agent.
 */

export interface QualityInput {
  /** The proposed video topic. */
  topic: string;
  /** Niche slug — used for copyright-risk hard-fail rules. */
  niche: string;
  /** Series episode template / format description for context. */
  series_context: string;
  /** Existing video topics on this channel (for duplicate detection). */
  existing_topics: string[];
}

/** Six scored dimensions, each 0–10. */
export interface QualityDimensions {
  /** Unique angle vs. what's already saturaing YouTube (higher = more original). */
  originality: number;
  /** Genuine insight, depth, or entertainment — not just surface summary (higher = more value). */
  genuine_value: number;
  /** Compliance with YouTube's 2026 "inauthentic content" / mass-production policy (higher = safer). */
  policy_compliance: number;
  /** Produceable with AI visuals only — no real footage required (higher = safer). */
  ai_producibility: number;
  /** ContentID / copyright exposure. 0 = none, 10 = certain strike. (lower = safer). */
  copyright_risk: number;
  /** Similarity to an already-planned or published topic on this channel. (lower = safer). */
  duplicate_similarity: number;
  /** Claude's free-text reasoning for this evaluation. */
  reasoning: string;
  /** Concrete changes that would make a failing topic pass, if any. */
  recommendations: string[];
}

export interface QualityVerdict {
  passed: boolean;
  /** Composite score 0–100. Threshold is 60. */
  score: number;
  dimensions: QualityDimensions;
  /** Human-readable list of reasons (failures or concerns). */
  reasons: string[];
  /** Machine-readable flags for downstream agents, e.g. "copyright_risk_high". */
  flags: string[];
}

/** Hard-fail rules that override the composite score. */
export const HARD_FAIL_RULES = [
  {
    flag: "policy_violation",
    test: (d: QualityDimensions) => d.policy_compliance < 4,
    reason: "Policy compliance score too low — YouTube demonetisation risk",
  },
  {
    flag: "copyright_risk_high",
    test: (d: QualityDimensions) => d.copyright_risk > 7,
    reason: "Copyright risk too high — ContentID strike risk",
  },
  {
    flag: "not_ai_producible",
    test: (d: QualityDimensions) => d.ai_producibility < 3,
    reason: "Topic requires real footage or clips — cannot produce with AI visuals only",
  },
  {
    flag: "duplicate_topic",
    test: (d: QualityDimensions) => d.duplicate_similarity > 8,
    reason: "Too similar to an existing video on this channel — pick a differentiated angle",
  },
] as const;

/** Composite score threshold to pass (0–100). */
export const PASS_THRESHOLD = 60;

/**
 * Weighted formula:
 *   originality        25%
 *   genuine_value      25%
 *   policy_compliance  20%
 *   ai_producibility   15%
 *   (10 - copyright_risk)    10%  ← inverted: lower risk = higher score
 *   (10 - duplicate_similarity)  5%  ← inverted
 */
export function computeScore(d: QualityDimensions): number {
  const raw =
    d.originality * 0.25 +
    d.genuine_value * 0.25 +
    d.policy_compliance * 0.2 +
    d.ai_producibility * 0.15 +
    (10 - d.copyright_risk) * 0.1 +
    (10 - d.duplicate_similarity) * 0.05;

  // raw is 0–10; multiply by 10 for 0–100 scale
  return Math.round(raw * 10 * 10) / 10;
}
