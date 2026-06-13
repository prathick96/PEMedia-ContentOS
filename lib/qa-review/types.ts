/**
 * lib/qa-review/types.ts
 *
 * Types for the QA Reviewer — the gate between a PRODUCED package and the
 * Publisher. Where the quality-gate (lib/quality-gate) scores a *topic* before
 * any resources are spent, the QA Reviewer scores the *finished package* (script
 * + narration + visual plan + thumbnail + metadata + the vertical short) and
 * decides whether it is safe to publish autonomously, needs a human glance, or
 * must be rejected and regenerated.
 *
 * Council Brief 003 ruling: we NEVER hide AI provenance. `compliance_disclosure`
 * scores whether disclosure is intact and honest — not whether it's hidden.
 */

/** Ten review dimensions, each 0–10. */
export interface QADimensions {
  /** Does the first 0–5s stop the scroll? */
  hook_strength: number;
  /** Escalation + re-hooks + no filler across the body. */
  retention_structure: number;
  /** Reads like a human wrote it, in the channel's voice; TTS-clean narration. */
  narration_humanness: number;
  /** Genuine insight/entertainment vs. templated AI slop (anti inauthentic-content). */
  originality_value: number;
  /** Thumbnail concept present, ≤4 words, readable at 120px, on-brand. */
  thumbnail_quality: number;
  /** Title/description/tags/chapters complete and optimised, no broken placeholders. */
  metadata_quality: number;
  /** Vertical short exists, self-contained, captioned, hook in frame 1. */
  short_cut_quality: number;
  /** AI disclosure intact + honest; required labels present. Higher = safer. */
  compliance_disclosure: number;
  /** No real footage/clips/licensed music; AI/own/pre-licensed only. Higher = safer. */
  copyright_safety: number;
  /** Reviewer's free-text reasoning. */
  reasoning: string;
  /** Concrete fixes that would lift a borderline/failing package. */
  fixes: string[];
}

export type QADecision = "auto_publish" | "needs_human_review" | "reject";

export interface QAVerdict {
  decision: QADecision;
  /** Composite 0–100. */
  score: number;
  dimensions: QADimensions;
  reasons: string[];
  /** Machine-readable flags for downstream agents/UI. */
  flags: string[];
}

/**
 * Hard fails override the composite score → always `reject`. These encode the
 * non-negotiables: honest disclosure and zero copyright exposure.
 */
export const QA_HARD_FAIL_RULES = [
  {
    flag: "disclosure_compromised",
    test: (d: QADimensions) => d.compliance_disclosure < 5,
    reason:
      "AI disclosure missing or compromised — synthetic media must be disclosed (YPP suspension risk)",
  },
  {
    flag: "copyright_risk",
    test: (d: QADimensions) => d.copyright_safety < 4,
    reason: "Copyright exposure — possible real footage/clips/licensed music (ContentID strike risk)",
  },
] as const;

/** ≥ this composite (and no hard fail) → safe to publish without a human. */
export const AUTO_PUBLISH_THRESHOLD = 78;
/** Between this and AUTO_PUBLISH → route to a human reviewer. Below → reject. */
export const HUMAN_REVIEW_THRESHOLD = 58;

/**
 * Weighted composite (weights sum to 1.0). Originality carries the most weight —
 * it is the moat and the thing YouTube's inauthentic-content policy punishes.
 */
export function computeQAScore(d: QADimensions): number {
  const raw =
    d.hook_strength * 0.15 +
    d.retention_structure * 0.15 +
    d.narration_humanness * 0.15 +
    d.originality_value * 0.2 +
    d.thumbnail_quality * 0.08 +
    d.metadata_quality * 0.07 +
    d.short_cut_quality * 0.05 +
    d.compliance_disclosure * 0.075 +
    d.copyright_safety * 0.075;
  return Math.round(raw * 10 * 10) / 10; // 0–10 → 0–100, 1dp
}

/** Hard-fail rules that currently trip for these dimensions. */
export function qaHardFails(d: QADimensions) {
  return QA_HARD_FAIL_RULES.filter((r) => r.test(d));
}

/**
 * Map a composite score + hard fails to a decision. Any hard fail → reject,
 * regardless of score.
 */
export function decideQA(score: number, hasHardFail: boolean): QADecision {
  if (hasHardFail) return "reject";
  if (score >= AUTO_PUBLISH_THRESHOLD) return "auto_publish";
  if (score >= HUMAN_REVIEW_THRESHOLD) return "needs_human_review";
  return "reject";
}
