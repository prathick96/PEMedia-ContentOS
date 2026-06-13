/**
 * lib/qa-review/index.ts
 *
 * QA Reviewer — scores a finished package and returns a publish decision:
 *   auto_publish | needs_human_review | reject
 *
 * Usage (QA Reviewer Agent):
 *   import { reviewPackage } from "@/lib/qa-review";
 *   const verdict = await reviewPackage({ topic, niche, series_format, brand_voice, script, db, video_id });
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewDimensions, type ReviewInput } from "./reviewer";
import {
  computeQAScore,
  decideQA,
  qaHardFails,
  type QADimensions,
  type QAVerdict,
} from "./types";

export interface ReviewPackageInput extends ReviewInput {
  db: SupabaseClient;
  video_id?: string;
  series_id?: string;
}

export async function reviewPackage(input: ReviewPackageInput): Promise<QAVerdict> {
  const dimensions = await reviewDimensions(input);
  const verdict = verdictFromDimensions(dimensions);

  await persistResult(input.db, {
    video_id: input.video_id,
    series_id: input.series_id,
    topic: input.topic,
    verdict,
  }).catch((err) => console.warn("[qa-review] persist failed:", err));

  return verdict;
}

/** Pure composition of score + hard-fails + decision into a verdict. */
export function verdictFromDimensions(dimensions: QADimensions): QAVerdict {
  const score = computeQAScore(dimensions);
  const hardFails = qaHardFails(dimensions);
  const decision = decideQA(score, hardFails.length > 0);

  const reasons: string[] = [];
  const flags: string[] = [];

  for (const f of hardFails) {
    reasons.push(f.reason);
    flags.push(f.flag);
  }

  if (decision === "auto_publish") {
    reasons.push(`Passed QA with composite ${score}/100 — clear to publish.`);
  } else if (decision === "needs_human_review") {
    reasons.push(`Composite ${score}/100 — borderline, routing to a human reviewer.`);
    flags.push("needs_human_review");
  } else if (hardFails.length === 0) {
    reasons.push(`Composite ${score}/100 below the publish floor — reject and regenerate.`);
    flags.push("below_floor");
  }
  if (dimensions.fixes.length > 0) reasons.push(`Fixes: ${dimensions.fixes.slice(0, 3).join("; ")}`);

  return { decision, score, dimensions, reasons, flags };
}

async function persistResult(
  db: SupabaseClient,
  {
    video_id,
    series_id,
    topic,
    verdict,
  }: { video_id?: string; series_id?: string; topic: string; verdict: QAVerdict }
) {
  await db.from("qa_review_results").insert({
    video_id: video_id ?? null,
    series_id: series_id ?? null,
    topic,
    decision: verdict.decision,
    score: verdict.score,
    dimensions: verdict.dimensions,
    reasons: verdict.reasons,
    flags: verdict.flags,
    evaluated_at: new Date().toISOString(),
  });
}

export type { QAVerdict, QADimensions, QADecision } from "./types";
