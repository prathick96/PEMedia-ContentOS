import type { VideoScript, VideoScriptSection } from "@/lib/db/schema";

/**
 * Pure helpers for turning a script package into voice-ready TTS text.
 * No I/O — safe to use anywhere (agents, API routes, tests).
 */

/** Voice-ready text for one section — prefers the TTS-tuned narration, falls back to legacy content. */
function sectionNarration(section: VideoScriptSection): string {
  const narration = section.narration?.trim();
  if (narration) return narration;
  return section.content?.trim() ?? "";
}

/**
 * Joins hook + per-section narrations + CTA into a single TTS-ready string,
 * separated by blank lines. Empty or missing pieces are skipped so the output
 * never contains stray separators.
 */
export function buildTtsNarration(script: VideoScript): string {
  const parts: string[] = [];

  const hook = script.hook?.trim();
  if (hook) parts.push(hook);

  for (const section of script.sections ?? []) {
    const narration = sectionNarration(section);
    if (narration) parts.push(narration);
  }

  const cta = script.cta?.trim();
  if (cta) parts.push(cta);

  return parts.join("\n\n");
}

/**
 * Guarantees `tts_narration` is present on a script package. If the model
 * already produced one it is preserved untouched; otherwise it is derived
 * from hook + sections + CTA via buildTtsNarration. Returns a new object —
 * the input is never mutated.
 */
export function ensureTtsNarration(script: VideoScript): VideoScript {
  if (script.tts_narration?.trim()) return script;
  return { ...script, tts_narration: buildTtsNarration(script) };
}
