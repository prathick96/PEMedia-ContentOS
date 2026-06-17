/**
 * lib/quality-gate/refine.ts
 *
 * The regeneration loop that sits in front of the quality gate.
 *
 * A failing gate is no longer a dead end. The gate already hands back exactly
 * what's needed to fix the topic — `dimensions.reasoning`, `recommendations`,
 * and per-dimension scores. This module feeds that signal to a focused "Topic
 * Editor" call that reframes the topic to a sharper angle (keeping the subject
 * seed, fitting the series format, correcting factual slips), then re-scores it.
 * It loops, bounded by `maxAttempts`, and returns the first topic that PASSES —
 * or, if none does, the best-scoring attempt so the caller can fail informatively.
 *
 * The threshold never moves: this raises the quality of what gets produced, it
 * does not lower the bar for what's allowed through.
 *
 * The loop logic is pure and dependency-injectable (scoreFn / reframeFn) so it's
 * unit-testable without any live LLM or database calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, parseJsonResponse } from "@/lib/anthropic";
import { scoreTopicQuality } from "./index";
import type { QualityDimensions, QualityVerdict } from "./types";

/** One pass through the loop: a topic that was scored by the gate. */
export interface RefineAttempt {
  /** 1-based attempt index. */
  attempt: number;
  /** The topic evaluated on this attempt. */
  topic: string;
  /** The gate verdict for this topic. */
  verdict: QualityVerdict;
  /** True if this topic was a reframe of an earlier one (attempt > 1). */
  reframed: boolean;
}

export interface RefineResult {
  /** Did any attempt pass the gate? */
  passed: boolean;
  /** The final topic to produce — the passing one, or the best-scoring attempt. */
  topic: string;
  /** The verdict for `topic`. */
  verdict: QualityVerdict;
  /** Every attempt made, in order. */
  attempts: RefineAttempt[];
  /** The topic originally proposed (attempt 1). */
  originalTopic: string;
}

export interface RefineInput {
  topic: string;
  niche: string;
  series_context?: string;
  series_id?: string;
  db: SupabaseClient;
  /** Total gate evaluations allowed (1 initial + up to N-1 reframes). Default 3. */
  maxAttempts?: number;
  /** Optional progress hook — fired once per scored attempt. */
  onAttempt?: (attempt: RefineAttempt) => void;
}

/** Injectable seams for unit testing the loop without LLM/DB calls. */
export interface RefineDeps {
  scoreFn?: (topic: string) => Promise<QualityVerdict>;
  reframeFn?: (args: { topic: string; verdict: QualityVerdict }) => Promise<string>;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Score a topic, and while it fails, reframe-and-re-score it up to `maxAttempts`
 * times. Returns the first passing topic, or the best-scoring attempt if none pass.
 *
 * Robustness:
 * - The first score is allowed to throw (surfaces genuine config/JSON errors,
 *   exactly as the gate did before this loop existed).
 * - A failing reframe (LLM error, empty/duplicate suggestion) stops the loop
 *   early and returns the best attempt so far — it never crashes the caller.
 */
export async function refineTopicUntilPass(
  input: RefineInput,
  deps: RefineDeps = {}
): Promise<RefineResult> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const originalTopic = input.topic;

  const scoreFn =
    deps.scoreFn ??
    ((topic: string) =>
      scoreTopicQuality({
        topic,
        niche: input.niche,
        series_context: input.series_context,
        series_id: input.series_id,
        db: input.db,
      }));

  const reframeFn =
    deps.reframeFn ??
    ((args: { topic: string; verdict: QualityVerdict }) =>
      reframeTopic({
        original: originalTopic,
        current: args.topic,
        niche: input.niche,
        series_context: input.series_context ?? "",
        verdict: args.verdict,
      }));

  const attempts: RefineAttempt[] = [];
  let currentTopic = originalTopic;
  let best: RefineAttempt | null = null;

  for (let i = 1; i <= maxAttempts; i++) {
    const verdict = await scoreFn(currentTopic);
    const attempt: RefineAttempt = {
      attempt: i,
      topic: currentTopic,
      verdict,
      reframed: i > 1,
    };
    attempts.push(attempt);
    input.onAttempt?.(attempt);

    if (!best || verdict.score > best.verdict.score) best = attempt;

    if (verdict.passed) {
      return { passed: true, topic: currentTopic, verdict, attempts, originalTopic };
    }

    // Out of budget — don't spend a reframe we can't re-score.
    if (i >= maxAttempts) break;

    try {
      const next = (await reframeFn({ topic: currentTopic, verdict })).trim();
      // A non-answer or a restated title means the editor has nothing better — stop.
      if (!next || next.toLowerCase() === currentTopic.toLowerCase()) break;
      currentTopic = next;
    } catch (err) {
      console.warn("[refine] reframe failed, stopping early:", err);
      break;
    }
  }

  // No attempt passed. `best` is non-null (the loop always scores at least once).
  const finalBest = best as RefineAttempt;
  return {
    passed: false,
    topic: finalBest.topic,
    verdict: finalBest.verdict,
    attempts,
    originalTopic,
  };
}

/** Compact one-line trail of the attempts, e.g. `"orig" 51.5 → "reframe" 58`. */
export function summariseAttempts(attempts: RefineAttempt[]): string {
  return attempts
    .map((a) => `"${a.topic}" ${a.verdict.score}/100`)
    .join("  →  ");
}

// ─── The Topic Editor (reframer) ─────────────────────────────────────────────

const REFRAMER_SYSTEM_PROMPT = `You are the Topic Editor for PEMedia — an autonomous, faceless YouTube studio.
A proposed video topic FAILED the quality gate. Produce ONE sharper replacement topic that keeps the
original subject seed but fixes the specific weaknesses the gate identified, and fits the series format exactly.

Principles:
- Keep the core subject; change the ANGLE. Originality comes from a specific, surprising lens — a concrete
  time window, a named tension or stake, a counter-intuitive cause — NOT from a broader or vaguer title.
- Fit the series format precisely. A "Last Days / collapse" series needs a fall arc and a turning point,
  not a general overview. A how-to series needs a concrete payoff, not a topic survey.
- A great topic implies depth a search result can't give: a question only this video answers.
- NEVER introduce unverifiable or false claims. If the original contained a factual error, correct it.
  Do not add any claim you are not confident is true.
- Stay 100% AI-producible and copyright-safe: no real footage, no clips, no copyrighted characters/music.

Output STRICT JSON only — no markdown, no commentary.`;

function weakDimensions(d: QualityDimensions): string[] {
  const out: string[] = [];
  if (d.originality < 6) out.push(`originality ${d.originality}/10 — angle is too common, find a distinctive lens`);
  if (d.genuine_value < 6) out.push(`genuine_value ${d.genuine_value}/10 — needs real depth/insight, not a summary`);
  if (d.policy_compliance < 6) out.push(`policy_compliance ${d.policy_compliance}/10 — reads as mass-produced`);
  if (d.duplicate_similarity > 5) out.push(`duplicate_similarity ${d.duplicate_similarity}/10 — too close to existing videos`);
  if (d.copyright_risk > 5) out.push(`copyright_risk ${d.copyright_risk}/10 — avoid footage-dependent angles`);
  if (d.ai_producibility < 6) out.push(`ai_producibility ${d.ai_producibility}/10 — must be makeable with AI visuals only`);
  return out;
}

interface ReframeArgs {
  original: string;
  current: string;
  niche: string;
  series_context: string;
  verdict: QualityVerdict;
}

function reframerPrompt(args: ReframeArgs): string {
  const { verdict } = args;
  const weak = weakDimensions(verdict.dimensions);
  const recs =
    verdict.dimensions.recommendations.length > 0
      ? verdict.dimensions.recommendations
      : ["Find a more specific, original angle that fits the series format."];

  return `The proposed topic failed the quality gate. Reframe it.

ORIGINAL TOPIC: "${args.original}"
${args.current !== args.original ? `PREVIOUS REFRAME (also failed): "${args.current}"\n` : ""}NICHE: ${args.niche}
SERIES FORMAT: ${args.series_context || "Standard explainer"}

GATE SCORE: ${verdict.score}/100 (needs 60+ to pass)
WHAT THE GATE FLAGGED:
${verdict.reasons.map((r) => `- ${r}`).join("\n")}
WEAK DIMENSIONS:
${weak.length > 0 ? weak.map((w) => `- ${w}`).join("\n") : "- (composite just short of threshold — sharpen the angle)"}
GATE REASONING: ${verdict.dimensions.reasoning}
GATE RECOMMENDATIONS:
${recs.map((r) => `- ${r}`).join("\n")}

Produce ONE replacement topic that directly addresses the above and fits the series format.
Output ONLY valid JSON: { "topic": "<the new topic title>", "angle": "<one sentence on why this is sharper>" }`;
}

/**
 * Ask the Topic Editor for a single reframed topic. Returns the new topic
 * string; throws if the model returns no usable topic (the loop treats a throw
 * as "stop refining, keep the best so far").
 */
export async function reframeTopic(args: ReframeArgs): Promise<string> {
  const raw = await generateText(REFRAMER_SYSTEM_PROMPT, reframerPrompt(args), {
    temperature: 0.8,
    maxTokens: 500,
  });
  const parsed = parseJsonResponse<{ topic?: string }>(raw);
  const topic = (parsed.topic ?? "").trim();
  if (!topic) throw new Error("Topic Editor returned no replacement topic");
  return topic;
}
