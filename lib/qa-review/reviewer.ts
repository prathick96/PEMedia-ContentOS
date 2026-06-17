/**
 * lib/qa-review/reviewer.ts
 *
 * Claude-powered review of a FINISHED video package. One structured call returns
 * the ten QA dimensions. Verdict/threshold logic lives in types.ts.
 */

import { generateText, parseJsonResponse } from "@/lib/anthropic";
import type { VideoScript } from "@/lib/db/schema";
import type { QADimensions } from "./types";

export interface ReviewInput {
  topic: string;
  niche: string;
  series_format: string;
  /** The channel's brand voice, serialized (string or {dos,donts,example}). */
  brand_voice: string;
  /** The produced package from the Production Agent. */
  script: VideoScript;
  /** Whether disclosure will be applied at publish (Publisher forces this true). */
  ai_disclosure_enforced: boolean;
}

const SYSTEM_PROMPT = `You are the QA REVIEWER for PEMedia — the last line of defense before a video publishes.
You review a FINISHED package (script, narration, visual plan, thumbnail, metadata, and the vertical
short cut) and judge whether it is good enough and safe enough to go live on YouTube autonomously.

You are strict. A false pass risks the channel: YouTube's 2026 inauthentic-content policy demonetises
templated, robotic, low-insight AI content, and undisclosed synthetic media risks Partner Program
suspension. You would rather route a borderline package to a human than publish slop.

CRITICAL — disclosure: PEMedia ALWAYS discloses AI. You score whether disclosure is intact and honest.
If a package tries to hide, obscure, or evade AI provenance, that is a FAIL (compliance_disclosure ≤ 2),
never a positive. "Human-like quality" means well-crafted, not deceptively concealed.

Score each dimension 0–10 and output STRICT JSON only.`;

const buildPrompt = (input: ReviewInput) => `Review this finished package for publication.

TOPIC: "${input.topic}"
NICHE: ${input.niche}
SERIES FORMAT: ${input.series_format || "Standard explainer"}
CHANNEL BRAND VOICE: ${input.brand_voice || "(unspecified)"}
AI DISCLOSURE WILL BE APPLIED AT PUBLISH: ${input.ai_disclosure_enforced ? "YES" : "NO"}

PACKAGE (JSON):
${JSON.stringify(input.script, null, 2)}

Output ONLY valid JSON matching this shape exactly:
{
  "hook_strength": <0-10>,
  "retention_structure": <0-10>,
  "narration_humanness": <0-10>,
  "originality_value": <0-10>,
  "thumbnail_quality": <0-10>,
  "metadata_quality": <0-10>,
  "short_cut_quality": <0-10>,
  "compliance_disclosure": <0-10>,
  "copyright_safety": <0-10>,
  "reasoning": "<concise paragraph>",
  "fixes": ["<concrete fix>", "..."]
}

Scoring guide:
- hook_strength: 9-10 opens an irresistible loop in <5s; 1-2 generic ("In this video...").
- retention_structure: 9-10 escalates + re-hooks, zero filler; 1-2 meanders.
- narration_humanness: 9-10 reads human and on-brand, TTS-clean; 1-2 robotic/templated.
- originality_value: 9-10 genuine insight/angle; 1-2 rehashed summary (slop).
- thumbnail_quality: 9-10 strong concept, ≤4 words, readable; 1-2 missing/cluttered.
- metadata_quality: 9-10 complete title/desc/tags/chapters, no broken [PLACEHOLDER]; low = gaps.
- short_cut_quality: 9-10 self-contained vertical, hook in frame 1, captions; 0 = no short_cut.
- compliance_disclosure: 10 disclosure intact+honest; ≤2 if anything tries to hide AI provenance.
- copyright_safety: 10 AI/own/pre-licensed only; ≤3 if any real footage/clips/licensed music implied.

Output JSON only.`;

export async function reviewDimensions(input: ReviewInput): Promise<QADimensions> {
  const raw = await generateText(SYSTEM_PROMPT, buildPrompt(input), { maxTokens: 2048 });
  const parsed = parseJsonResponse<Record<string, unknown>>(raw);

  const clamp = (v: unknown, fallback: number) =>
    typeof v === "number" ? Math.min(10, Math.max(0, v)) : fallback;

  return {
    hook_strength: clamp(parsed.hook_strength, 5),
    retention_structure: clamp(parsed.retention_structure, 5),
    narration_humanness: clamp(parsed.narration_humanness, 5),
    originality_value: clamp(parsed.originality_value, 5),
    thumbnail_quality: clamp(parsed.thumbnail_quality, 5),
    metadata_quality: clamp(parsed.metadata_quality, 5),
    short_cut_quality: clamp(parsed.short_cut_quality, 5),
    // Fail-safe defaults: if the model omits a compliance score, assume the worst,
    // not the best — a missing disclosure score must not silently auto-publish.
    compliance_disclosure: clamp(parsed.compliance_disclosure, input.ai_disclosure_enforced ? 8 : 3),
    copyright_safety: clamp(parsed.copyright_safety, 4),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning provided.",
    fixes: Array.isArray(parsed.fixes) ? (parsed.fixes as string[]).slice(0, 6) : [],
  };
}
