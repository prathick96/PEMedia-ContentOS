/**
 * lib/render/captions.ts — pure SRT generation. No I/O.
 *
 * Scene windows are sized proportionally to each scene's spoken word count and
 * scaled to the *actual* narration duration, so captions track the audio without
 * needing word-level timestamps (an upgrade path via ElevenLabs timestamps).
 */

import type { RenderScene } from "./types";

/** Seconds → "HH:MM:SS,mmm" (SRT timecode). */
export function secondsToSrtTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

/**
 * Build an SRT covering [0, totalDuration] with one cue per scene. Window length
 * is proportional to scene.words (min 1 so empty scenes still get a slice). The
 * final cue always ends exactly at totalDuration to avoid drift.
 */
export function buildSrt(scenes: RenderScene[], totalDuration: number): string {
  if (scenes.length === 0 || totalDuration <= 0) return "";

  const weights = scenes.map((s) => Math.max(1, s.words));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const cues: string[] = [];
  let t = 0;
  scenes.forEach((scene, i) => {
    const isLast = i === scenes.length - 1;
    const start = t;
    const end = isLast ? totalDuration : t + (totalDuration * weights[i]) / totalWeight;
    cues.push(
      `${i + 1}\n${secondsToSrtTime(start)} --> ${secondsToSrtTime(end)}\n${scene.text}`
    );
    t = end;
  });

  return cues.join("\n\n") + "\n";
}
