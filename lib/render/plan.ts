/**
 * lib/render/plan.ts — pure plan construction from a script package. No I/O.
 */

import type { ShortCut, VideoScript } from "@/lib/db/schema";
import { buildTtsNarration } from "@/lib/agents/script-utils";
import {
  ASPECT_DIMENSIONS,
  DEFAULT_BACKGROUND,
  type Aspect,
  type RenderOptions,
  type RenderPlan,
  type RenderScene,
} from "./types";

export function countWords(text: string | undefined | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Shorten a caption so it stays readable on screen. */
export function truncateCaption(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

/** Normalize a hex color (#rrggbb / rrggbb / 0xrrggbb) to ffmpeg's 0xRRGGBB. */
export function normalizeColor(hex: string | undefined): string {
  if (!hex) return DEFAULT_BACKGROUND;
  const m = hex.trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return DEFAULT_BACKGROUND;
  return `0x${m.toUpperCase()}`;
}

/** Caption text for a section: prefer the explicit on-screen text, else its title. */
function sectionCaption(section: { on_screen_text?: string; title?: string; narration?: string; content?: string }): string {
  const candidate =
    section.on_screen_text?.trim() ||
    section.title?.trim() ||
    section.narration?.trim() ||
    section.content?.trim() ||
    "";
  return truncateCaption(candidate);
}

/**
 * Build the long-form render plan. Scenes span the WHOLE narration (hook →
 * sections → CTA) so the word-proportional caption windows line up with the
 * actual spoken audio.
 */
export function buildRenderPlan(script: VideoScript, opts: RenderOptions = {}): RenderPlan {
  const aspect: Aspect = opts.aspect ?? "16:9";
  const { width, height } = ASPECT_DIMENSIONS[aspect];

  const scenes: RenderScene[] = [];

  const hook = script.hook?.trim();
  if (hook) scenes.push({ text: truncateCaption(hook), words: countWords(hook) });

  for (const section of script.sections ?? []) {
    const spoken = section.narration?.trim() || section.content?.trim() || "";
    const text = sectionCaption(section);
    if (text) scenes.push({ text, words: Math.max(countWords(spoken), countWords(text)) });
  }

  const cta = script.cta?.trim();
  if (cta) scenes.push({ text: truncateCaption(cta), words: countWords(cta) });

  const narration = (script.tts_narration?.trim() || buildTtsNarration(script)).trim();
  if (!narration) throw new Error("Cannot render: script has no narration text.");
  if (scenes.length === 0) scenes.push({ text: truncateCaption(narration), words: countWords(narration) });

  return {
    narration,
    scenes,
    width,
    height,
    backgroundColor: normalizeColor(opts.backgroundColor),
  };
}

/** Build the vertical short render plan from a ShortCut (9:16). */
export function buildShortRenderPlan(short: ShortCut, opts: RenderOptions = {}): RenderPlan {
  const aspect: Aspect = opts.aspect ?? "9:16";
  const { width, height } = ASPECT_DIMENSIONS[aspect];

  const narration = (short.tts_narration?.trim() || short.narration?.trim() || "").trim();
  if (!narration) throw new Error("Cannot render short: no narration text.");

  const captionSource =
    short.captions && short.captions.length > 0
      ? short.captions
      : [short.hook?.trim() || truncateCaption(narration)];

  const totalWords = countWords(narration);
  const scenes: RenderScene[] = captionSource
    .map((c) => truncateCaption(c))
    .filter(Boolean)
    .map((text, _i, arr) => ({ text, words: Math.max(1, Math.round(totalWords / arr.length)) }));

  return {
    narration,
    scenes: scenes.length > 0 ? scenes : [{ text: truncateCaption(narration), words: totalWords }],
    width,
    height,
    backgroundColor: normalizeColor(opts.backgroundColor),
  };
}
