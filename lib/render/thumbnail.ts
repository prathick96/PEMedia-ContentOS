/**
 * lib/render/thumbnail.ts
 *
 * Thumbnail generation from the script's thumbnail_concept — $0, no external API.
 * Reuses the exact ffmpeg + libass (subtitles) path the v1 caption render uses, so
 * font resolution behaves identically (no new cross-platform font risk): a single
 * frame of the brand color with the concept's ≤4-word text centered, exported PNG.
 *
 * Swappable later for an AI image provider (just replace generateThumbnail).
 */

import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { ThumbnailConcept } from "@/lib/db/schema";
import { normalizeColor } from "./plan";
import { secondsToSrtTime } from "./captions";
import { escapeSubtitlesPath, runFfmpeg } from "./ffmpeg";

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  outputDir?: string;
}

/** Pure: the overlay text — concept.text if present, else a fallback; ≤4 words, upper-cased. */
export function buildThumbnailText(concept: ThumbnailConcept | undefined, fallback: string): string {
  const raw = (concept?.text?.trim() || fallback || "").replace(/\s+/g, " ").trim();
  return raw.split(" ").filter(Boolean).slice(0, 4).join(" ").toUpperCase();
}

const THUMB_STYLE =
  "FontSize=64,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Outline=3,Shadow=2,Alignment=5,Bold=1";

export interface ThumbnailArgsInput {
  srtPath: string;
  outputPath: string;
  width: number;
  height: number;
  backgroundColor: string;
}

/** Pure: ffmpeg argv for a one-frame PNG (color background + centered text). */
export function buildThumbnailArgs(input: ThumbnailArgsInput): string[] {
  return [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${input.backgroundColor}:s=${input.width}x${input.height}`,
    "-vf", `subtitles=${escapeSubtitlesPath(input.srtPath)}:force_style='${THUMB_STYLE}'`,
    "-frames:v", "1",
    input.outputPath,
  ];
}

/** Render a thumbnail PNG and return its path. */
export async function generateThumbnail(
  concept: ThumbnailConcept | undefined,
  fallbackText: string,
  opts: ThumbnailOptions = {}
): Promise<string> {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const backgroundColor = normalizeColor(opts.backgroundColor);
  const text = buildThumbnailText(concept, fallbackText);
  if (!text) throw new Error("Cannot generate thumbnail: no text available.");

  const dir = opts.outputDir || join(tmpdir(), "pemedia-render");
  await mkdir(dir, { recursive: true });
  const stamp = Date.now();
  const srtPath = join(dir, `thumb-${stamp}.srt`);
  const outputPath = join(dir, `thumb-${stamp}.png`);

  await writeFile(srtPath, `1\n${secondsToSrtTime(0)} --> ${secondsToSrtTime(5)}\n${text}\n`, "utf8");
  await runFfmpeg(buildThumbnailArgs({ srtPath, outputPath, width, height, backgroundColor }));
  return outputPath;
}
