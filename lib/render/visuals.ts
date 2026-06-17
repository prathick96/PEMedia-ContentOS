/**
 * lib/render/visuals.ts — Pexels b-roll source for the render layer.
 *
 * Pure: query building + best-photo selection. I/O: Pexels search + download.
 * Used by the opt-in b-roll render path; the default render stays color-card.
 * Copyright-safe: Pexels content is free to use; we never use third-party
 * footage that carries ContentID risk.
 */

import { writeFile } from "fs/promises";
import type { Aspect } from "./types";

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  src: { large2x?: string; large?: string; original?: string };
}

/** Pure: a concise search query from a scene's keywords or caption text. */
export function buildPexelsQuery(text: string, keywords?: string[]): string {
  if (keywords && keywords.length > 0) return keywords.slice(0, 3).join(" ");
  return text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
}

/** Pure: pick the photo whose orientation best fits the target aspect. */
export function pickBestPhoto(photos: PexelsPhoto[], aspect: Aspect): PexelsPhoto | null {
  const usable = photos.filter((p) => Boolean(photoUrl(p)));
  if (usable.length === 0) return null;
  const wantLandscape = aspect === "16:9";
  const match = usable.find((p) => (wantLandscape ? p.width >= p.height : p.height > p.width));
  return match ?? usable[0];
}

/** Pure: best available source URL for a photo. */
export function photoUrl(p: PexelsPhoto): string {
  return p.src.large2x || p.src.large || p.src.original || "";
}

function pexelsKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY not set — required for b-roll visuals.");
  return key;
}

/** Search Pexels for photos matching a query, biased to the target aspect. */
export async function fetchScenePhotos(
  query: string,
  aspect: Aspect,
  perPage = 5
): Promise<PexelsPhoto[]> {
  const orientation = aspect === "16:9" ? "landscape" : "portrait";
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`;
  const res = await fetch(url, { headers: { Authorization: pexelsKey() } });
  if (!res.ok) throw new Error(`Pexels search failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { photos?: PexelsPhoto[] };
  return json.photos ?? [];
}

/** Download a remote image to a local path. */
export async function downloadToFile(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
}
