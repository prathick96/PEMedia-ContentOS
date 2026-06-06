/**
 * lib/quality-gate/scorer.ts
 *
 * Claude-powered multi-dimension quality scorer.
 * Makes a single structured LLM call and returns QualityDimensions.
 */

import { generateText } from "@/lib/anthropic";
import type { QualityDimensions, QualityInput } from "./types";

const SCORER_SYSTEM_PROMPT = `You are the Risk & Quality Analyst for PEMedia — an autonomous content studio.
Your job is to evaluate proposed YouTube video topics before any production resources are spent.

You score topics across 6 dimensions and output strict JSON. Be honest and conservative —
a false pass wastes ElevenLabs voice credits, video generation costs, and risks channel health.

YouTube's 2026 "inauthentic content" policy actively demonises:
- Topics that are purely summarised from other videos with no original angle
- Mass-produced content with no genuine insight or entertainment value
- AI-generated "information" videos that add nothing beyond what a search result provides

The studio model REQUIRES originality as its moat. Score accordingly.`;

const SCORER_PROMPT = (input: QualityInput) => `Evaluate this proposed video topic for quality and production safety.

TOPIC: "${input.topic}"
NICHE: ${input.niche}
SERIES FORMAT: ${input.series_context || "Standard explainer"}
EXISTING TOPICS ON THIS CHANNEL (check for duplicates):
${input.existing_topics.length > 0 ? input.existing_topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n") : "  (none yet — first video)"}

Score each dimension 0–10 and output ONLY valid JSON matching this shape exactly:
{
  "originality": <0-10>,
  "genuine_value": <0-10>,
  "policy_compliance": <0-10>,
  "ai_producibility": <0-10>,
  "copyright_risk": <0-10>,
  "duplicate_similarity": <0-10>,
  "reasoning": "<concise paragraph explaining your scores>",
  "recommendations": ["<change 1 that would improve the score>", "..."]
}

Scoring guide:
- originality: 9-10 = fresh perspective no one has taken; 5-6 = competent take on common topic; 1-2 = pure rehash
- genuine_value: 9-10 = deep insight, original research angle, real entertainment; 1-2 = surface summary
- policy_compliance: 9-10 = clearly original human-in-the-loop value; 4 = borderline; <4 = mass-produced AI slop territory
- ai_producibility: 10 = fully AI-visual; 5 = needs some stock footage; 0 = requires real clips (HARD FAIL)
- copyright_risk: 0 = none (history, tech); 5 = moderate; 8+ = ContentID strike likely (movie clips, sports footage)
- duplicate_similarity: 0 = totally fresh; 5 = similar theme but different angle; 9+ = nearly identical topic

Output JSON only. No markdown, no explanation outside the JSON.`;

/**
 * Call Claude to score a topic across all 6 quality dimensions.
 * Returns raw dimensions (scoring and verdict logic is in index.ts).
 */
export async function scoreDimensions(input: QualityInput): Promise<QualityDimensions> {
  const raw = await generateText(SCORER_SYSTEM_PROMPT, SCORER_PROMPT(input));

  // Strip markdown fences if Claude wraps it
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Quality scorer returned invalid JSON. Raw response: ${raw.slice(0, 300)}`);
  }

  // Validate and clamp all numeric dimensions
  const clamp = (v: unknown, fallback: number) =>
    typeof v === "number" ? Math.min(10, Math.max(0, v)) : fallback;

  return {
    originality: clamp(parsed.originality, 5),
    genuine_value: clamp(parsed.genuine_value, 5),
    policy_compliance: clamp(parsed.policy_compliance, 5),
    ai_producibility: clamp(parsed.ai_producibility, 5),
    copyright_risk: clamp(parsed.copyright_risk, 5),
    duplicate_similarity: clamp(parsed.duplicate_similarity, 0),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
    recommendations: Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as string[]).slice(0, 5)
      : [],
  };
}
