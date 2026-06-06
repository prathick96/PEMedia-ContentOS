/**
 * lib/quality-gate/index.ts
 *
 * Quality / originality gate — the safeguard between a topic and production.
 *
 * Usage (Production Agent):
 *   import { scoreTopicQuality } from "@/lib/quality-gate";
 *
 *   const verdict = await scoreTopicQuality({ topic, niche, series_context, db });
 *   if (!verdict.passed) throw new Error(`Quality gate failed: ${verdict.reasons.join("; ")}`);
 *
 * The gate:
 *   1. Pulls existing video topics from this channel (Supabase, for duplicate check)
 *   2. Calls Claude once with a structured scoring prompt (6 dimensions)
 *   3. Applies weighted composite formula → score/100
 *   4. Applies hard-fail rules (policy, copyright, producibility, duplicates)
 *   5. Persists the result to quality_gate_results for audit
 *   6. Returns a typed QualityVerdict
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreDimensions } from "./scorer";
import {
  computeScore,
  HARD_FAIL_RULES,
  PASS_THRESHOLD,
  type QualityInput,
  type QualityVerdict,
} from "./types";

interface GateInput {
  topic: string;
  niche: string;
  series_context?: string;
  /** Supabase client from the calling agent (already initialised). */
  db: SupabaseClient;
  /** Optional: pre-fetched series_id for audit logging. */
  series_id?: string;
  /** Optional: video_id if the video row was already created. */
  video_id?: string;
}

/**
 * Run the quality gate for a proposed video topic.
 * Throws only on unexpected errors — a failed gate returns { passed: false }.
 */
export async function scoreTopicQuality(input: GateInput): Promise<QualityVerdict> {
  const { topic, niche, series_context = "", db, series_id, video_id } = input;

  // 1. Pull existing topics on this channel for duplicate detection
  const existing_topics = await fetchExistingTopics(db, series_id);

  // 2. Score all 6 dimensions via Claude
  const scorerInput: QualityInput = { topic, niche, series_context, existing_topics };
  const dimensions = await scoreDimensions(scorerInput);

  // 3. Compute weighted composite score
  const score = computeScore(dimensions);

  // 4. Apply hard-fail rules (override score regardless of composite)
  const hardFails = HARD_FAIL_RULES.filter((rule) => rule.test(dimensions));
  const hardFailed = hardFails.length > 0;

  // 5. Determine pass/fail
  const passed = !hardFailed && score >= PASS_THRESHOLD;

  // 6. Build reasons + flags
  const reasons: string[] = [];
  const flags: string[] = [];

  for (const fail of hardFails) {
    reasons.push(fail.reason);
    flags.push(fail.flag);
  }

  if (!hardFailed && score < PASS_THRESHOLD) {
    reasons.push(`Composite score ${score}/100 is below the ${PASS_THRESHOLD} threshold`);
    flags.push("score_below_threshold");
    if (dimensions.originality < 5) {
      reasons.push("Low originality — topic needs a more distinctive angle");
    }
    if (dimensions.genuine_value < 5) {
      reasons.push("Low genuine value — add deeper insight or unique framing");
    }
  }

  if (passed) {
    reasons.push(`Passed with composite score ${score}/100`);
  }

  const verdict: QualityVerdict = { passed, score, dimensions, reasons, flags };

  // 7. Persist result for audit (best-effort — don't fail the gate if this errors)
  await persistResult(db, { topic, series_id, video_id, verdict }).catch((err) => {
    console.warn("[quality-gate] Failed to persist result:", err);
  });

  return verdict;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchExistingTopics(db: SupabaseClient, series_id?: string): Promise<string[]> {
  if (!series_id) return [];

  // Resolve the channel for this series, then pull recent topics across the
  // whole channel (catches duplicates across sibling series, not just this one).
  const { data: seriesRow } = await db
    .from("series")
    .select("channel_id")
    .eq("id", series_id)
    .single();

  const channelId = (seriesRow as { channel_id?: string } | null)?.channel_id;

  let topics: string[] = [];

  if (channelId) {
    const { data: siblingSeries } = await db
      .from("series")
      .select("id")
      .eq("channel_id", channelId);

    const seriesIds = (siblingSeries ?? []).map((s: { id: string }) => s.id);

    if (seriesIds.length > 0) {
      const { data: channelVideos } = await db
        .from("videos")
        .select("topic")
        .in("series_id", seriesIds)
        .not("status", "eq", "ARCHIVED")
        .order("created_at", { ascending: false })
        .limit(50);

      topics = (channelVideos ?? []).map((v: { topic: string }) => v.topic).filter(Boolean);
    }
  }

  // Fallback: at minimum, check this series directly (covers edge cases above)
  if (topics.length === 0) {
    const { data: seriesVideos } = await db
      .from("videos")
      .select("topic")
      .eq("series_id", series_id)
      .not("status", "eq", "ARCHIVED")
      .order("created_at", { ascending: false })
      .limit(30);

    topics = (seriesVideos ?? []).map((v: { topic: string }) => v.topic).filter(Boolean);
  }

  return [...new Set(topics)]; // deduplicate
}

async function persistResult(
  db: SupabaseClient,
  {
    topic,
    series_id,
    video_id,
    verdict,
  }: {
    topic: string;
    series_id?: string;
    video_id?: string;
    verdict: QualityVerdict;
  }
) {
  await db.from("quality_gate_results").insert({
    topic,
    series_id: series_id ?? null,
    video_id: video_id ?? null,
    passed: verdict.passed,
    score: verdict.score,
    dimensions: verdict.dimensions,
    reasons: verdict.reasons,
    flags: verdict.flags,
    evaluated_at: new Date().toISOString(),
  });
}

// Re-export types for consumers
export type { QualityVerdict, QualityInput, QualityDimensions } from "./types";
