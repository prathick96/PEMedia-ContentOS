/**
 * lib/agents/script-length.ts
 *
 * Length + structure enforcement for the Production package (council-brief decision).
 *
 * The model was overshooting badly (a 13.8-min long-form, a 74s short). We target:
 *   - long-form: 6–8 min  → 900–1200 spoken words at ~150 wpm
 *   - short:     30–40 s  → 75–100 spoken words
 * and require a hook + content + a distinct retention-driving ending in both.
 *
 * Word count is the cheap pre-TTS gate; actual rendered audio duration is the
 * ground-truth check (see render). All pure — no I/O, fully testable.
 */

import { countWords } from "@/lib/render/plan";
import { buildTtsNarration } from "./script-utils";
import type { VideoScript } from "@/lib/db/schema";

/** Voiceover pace assumption (ElevenLabs baseline; recalibrate against real renders). */
export const WPM = 150;

/** ~6–8 min of long-form narration. */
export const LONGFORM_WORD_RANGE = { min: 900, max: 1200 } as const;
/** ~30–40 s of short narration. */
export const SHORT_WORD_RANGE = { min: 75, max: 100 } as const;

export interface LengthCheck {
  ok: boolean;
  longWords: number;
  shortWords: number;
  estLongSecs: number;
  estShortSecs: number;
  /** Has a non-empty hook AND a non-empty ending (cta) on the long-form. */
  hasLongStructure: boolean;
  /** Has a non-empty hook AND a non-empty ending (cta) on the short. */
  hasShortStructure: boolean;
  issues: string[];
}

function secs(words: number): number {
  return Math.round((words / WPM) * 60);
}

/** Spoken words in the long-form narration (TTS text, or derived from hook+sections+cta). */
export function longFormWords(script: VideoScript): number {
  return countWords(script.tts_narration?.trim() || buildTtsNarration(script));
}

/** Spoken words in the short's narration. */
export function shortWords(script: VideoScript): number {
  const cut = script.short_cut;
  return countWords(cut?.tts_narration?.trim() || cut?.narration?.trim() || "");
}

/**
 * Validate a generated package against the length + structure targets. Returns a
 * structured result; `issues` is human-readable feedback the retry prompt reuses.
 */
export function checkScriptLength(script: VideoScript): LengthCheck {
  const longW = longFormWords(script);
  const shortW = shortWords(script);

  const hasLongStructure = !!script.hook?.trim() && !!script.cta?.trim();
  const hasShortStructure = !!script.short_cut?.hook?.trim() && !!script.short_cut?.cta?.trim();

  const issues: string[] = [];

  if (longW < LONGFORM_WORD_RANGE.min)
    issues.push(`Long-form too SHORT: ${longW} words (~${secs(longW)}s). Expand to ${LONGFORM_WORD_RANGE.min}–${LONGFORM_WORD_RANGE.max} words (6–8 min).`);
  if (longW > LONGFORM_WORD_RANGE.max)
    issues.push(`Long-form too LONG: ${longW} words (~${secs(longW)}s). Cut to ${LONGFORM_WORD_RANGE.min}–${LONGFORM_WORD_RANGE.max} words (6–8 min).`);

  if (shortW < SHORT_WORD_RANGE.min)
    issues.push(`Short too SHORT: ${shortW} words (~${secs(shortW)}s). Expand to ${SHORT_WORD_RANGE.min}–${SHORT_WORD_RANGE.max} words (30–40s).`);
  if (shortW > SHORT_WORD_RANGE.max)
    issues.push(`Short too LONG: ${shortW} words (~${secs(shortW)}s). Cut to ${SHORT_WORD_RANGE.min}–${SHORT_WORD_RANGE.max} words (30–40s).`);

  if (!hasLongStructure)
    issues.push("Long-form is missing a clear hook and/or a distinct ending (hook + cta both required).");
  if (!hasShortStructure)
    issues.push("Short is missing a clear hook and/or a distinct ending (short_cut.hook + short_cut.cta both required).");

  return {
    ok: issues.length === 0,
    longWords: longW,
    shortWords: shortW,
    estLongSecs: secs(longW),
    estShortSecs: secs(shortW),
    hasLongStructure,
    hasShortStructure,
    issues,
  };
}

/** One-line revision instruction injected into the retry prompt when the gate fails. */
export function lengthRevisionNote(check: LengthCheck): string {
  return (
    `Your previous draft missed the length/structure targets — ${check.issues.join(" ")} ` +
    `Rewrite to hit: long-form ${LONGFORM_WORD_RANGE.min}–${LONGFORM_WORD_RANGE.max} words total narration (6–8 min), ` +
    `short_cut ${SHORT_WORD_RANGE.min}–${SHORT_WORD_RANGE.max} words (30–40s). ` +
    `Keep a sharp hook and a strong retention-driving ending; adjust the middle to hit the count. ` +
    `Return the full JSON package again.`
  );
}
