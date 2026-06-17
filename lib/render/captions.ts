/**
 * lib/render/captions.ts — pure SRT generation. No I/O.
 *
 * Scene windows are sized proportionally to each scene's spoken word count and
 * scaled to the *actual* narration duration, so captions track the audio without
 * needing word-level timestamps (an upgrade path via ElevenLabs timestamps).
 */

import type { VoiceAlignment } from "@/lib/elevenlabs";
import type { RenderScene } from "./types";

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

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

/**
 * Pure: collapse ElevenLabs per-character alignment into per-word timings.
 * A word starts at its first non-space character and ends at its last.
 */
export function parseAlignment(alignment: VoiceAlignment | null | undefined): TimedWord[] {
  const chars = alignment?.characters;
  if (!chars || chars.length === 0) return [];
  const starts = alignment!.character_start_times_seconds ?? [];
  const ends = alignment!.character_end_times_seconds ?? [];

  const words: TimedWord[] = [];
  let text = "";
  let start = 0;
  let end = 0;
  let open = false;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const s = starts[i] ?? end;
    const e = ends[i] ?? s;
    if (/\s/.test(ch)) {
      if (open && text.trim()) words.push({ text: text.trim(), start, end });
      text = "";
      open = false;
    } else {
      if (!open) {
        start = s;
        open = true;
      }
      text += ch;
      end = e;
    }
  }
  if (open && text.trim()) words.push({ text: text.trim(), start, end });
  return words;
}

/**
 * Pure: merge per-chunk word timings into one timeline. Each chunk's timings are
 * local (start near 0); every word in chunk i is shifted by the summed durations of
 * chunks 0..i-1, so the words line up with the concatenated audio.
 */
export function mergeTimedChunks(
  chunks: { words: TimedWord[]; duration: number }[]
): TimedWord[] {
  const out: TimedWord[] = [];
  let offset = 0;
  for (const chunk of chunks) {
    for (const w of chunk.words) {
      out.push({ text: w.text, start: w.start + offset, end: w.end + offset });
    }
    offset += chunk.duration;
  }
  return out;
}

/**
 * Pure: word-synced (karaoke) SRT — groups words into short cues of up to
 * maxWordsPerCue, each timed to its words' actual spoken start/end.
 */
export function wordsToSrt(words: TimedWord[], opts: { maxWordsPerCue?: number } = {}): string {
  const max = Math.max(1, opts.maxWordsPerCue ?? 4);
  if (words.length === 0) return "";

  const cues: string[] = [];
  for (let i = 0; i < words.length; i += max) {
    const chunk = words.slice(i, i + max);
    cues.push(
      `${cues.length + 1}\n${secondsToSrtTime(chunk[0].start)} --> ${secondsToSrtTime(
        chunk[chunk.length - 1].end
      )}\n${chunk.map((w) => w.text).join(" ")}`
    );
  }
  return cues.join("\n\n") + "\n";
}
