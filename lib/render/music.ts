/**
 * lib/render/music.ts — royalty-free background music selection.
 *
 * Music is read from a local library folder (CONTENT_MUSIC_DIR, default
 * ~/ContentOS/music) so you stay fully in control of licensing — drop CC0 /
 * royalty-free tracks in (e.g. from Pixabay Music, the YouTube Audio Library, or
 * Incompetech). Optionally group by niche in subfolders (…/music/tech, …/music/history).
 *
 * It is always optional: a missing/empty folder simply means no music bed, never an error.
 */

import { readdir } from "fs/promises";
import { homedir } from "os";
import { isAbsolute, join } from "path";

/** Bed volume relative to the narration (narration stays at full). */
export const MUSIC_BED_VOLUME = 0.12;

const AUDIO_EXT = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"]);

export function resolveMusicDir(): string {
  const env = process.env.CONTENT_MUSIC_DIR?.trim();
  if (env) return isAbsolute(env) ? env : join(process.cwd(), env);
  return join(homedir(), "ContentOS", "music");
}

/** Pure: true if a filename looks like a supported audio track. */
export function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot >= 0 && AUDIO_EXT.has(name.slice(dot).toLowerCase());
}

/** Pure: choose one item from a list (random by default; injectable rng for tests). */
export function pickFromList<T>(items: T[], rng: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length) % items.length];
}

/**
 * Pick a track from CONTENT_MUSIC_DIR — preferring a <niche> subfolder, then the base
 * folder. Returns an absolute path, or null when no library/track exists (music is
 * optional). Never throws.
 */
export async function pickMusicTrack(niche?: string): Promise<string | null> {
  const base = resolveMusicDir();
  const dirs = niche ? [join(base, niche), base] : [base];
  for (const dir of dirs) {
    try {
      const choice = pickFromList((await readdir(dir)).filter(isAudioFile));
      if (choice) return join(dir, choice);
    } catch {
      /* dir missing/unreadable — try the next, else give up */
    }
  }
  return null;
}
