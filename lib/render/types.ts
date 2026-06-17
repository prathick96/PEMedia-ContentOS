/**
 * lib/render/types.ts
 *
 * The render layer turns a Production package into an actual MP4. v1 is the
 * free-tier, fully-autonomous path: ElevenLabs narration + a brand-colored
 * background with burned-in captions, assembled by ffmpeg. Stock/AI b-roll is a
 * pluggable upgrade (see council-brief-003 roadmap).
 */

export type Aspect = "16:9" | "9:16";

/** One on-screen caption window, sized proportionally to its spoken length. */
export interface RenderScene {
  /** Caption text burned on screen for this window. */
  text: string;
  /** Spoken word count for this beat — drives proportional timing. */
  words: number;
  /** Stock-search keywords for this beat (b-roll path). */
  keywords?: string[];
}

export interface RenderPlan {
  /** Full TTS-ready narration sent to the voice engine. */
  narration: string;
  scenes: RenderScene[];
  width: number;
  height: number;
  /** ffmpeg color, normalized to 0xRRGGBB. */
  backgroundColor: string;
}

export interface RenderOptions {
  aspect?: Aspect;
  /** Brand color (hex, with or without #) for the background. */
  backgroundColor?: string;
  /** ElevenLabs voice id; falls back to ELEVENLABS_VOICE_ID. */
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  /** Output directory; defaults to <tmp>/pemedia-render. */
  outputDir?: string;
  /** Visual style: "color" (default, brand background) or "pexels" (b-roll, opt-in). */
  visualSource?: "color" | "pexels";
}

export interface RenderResult {
  videoPath: string;
  durationSecs: number;
  width: number;
  height: number;
  sceneCount: number;
}

export const ASPECT_DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

/** Default near-black background when no brand color is supplied. */
export const DEFAULT_BACKGROUND = "0x0B0B0F";
