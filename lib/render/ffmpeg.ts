/**
 * lib/render/ffmpeg.ts
 *
 * ffmpeg assembly: a brand-colored background for the length of the narration,
 * with captions burned in via the subtitles (libass) filter — robust to
 * punctuation in a way drawtext is not — muxed with the narration audio.
 *
 * The argument builder is pure (and tested); runFfmpeg/probeDurationSecs shell
 * out to the ffmpeg/ffprobe binaries (must be installed and on PATH).
 */

import { spawn } from "child_process";
import type { RenderPlan } from "./types";

/**
 * Escape a path for the subtitles filter. libass on Windows needs backslashes
 * turned into forward slashes and the drive-letter colon escaped.
 */
export function escapeSubtitlesPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

const FORCE_STYLE =
  "FontSize=22,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Outline=2,Shadow=1,Alignment=2,MarginV=72,Bold=1";

export function buildSubtitlesFilter(srtPath: string): string {
  return `subtitles=${escapeSubtitlesPath(srtPath)}:force_style='${FORCE_STYLE}'`;
}

export interface RenderArgsInput {
  audioPath: string;
  srtPath: string;
  plan: Pick<RenderPlan, "width" | "height" | "backgroundColor">;
  outputPath: string;
}

/** Pure: the full ffmpeg argv. -shortest bounds the infinite color source to the audio. */
export function buildRenderArgs({ audioPath, srtPath, plan, outputPath }: RenderArgsInput): string[] {
  return [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${plan.backgroundColor}:s=${plan.width}x${plan.height}:r=30`,
    "-i", audioPath,
    "-vf", buildSubtitlesFilter(srtPath),
    "-c:v", "libx264",
    "-tune", "stillimage",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    outputPath,
  ];
}

/** Run ffmpeg with the given args. Rejects with stderr tail on non-zero exit. */
export function runFfmpeg(args: string[]): Promise<void> {
  return runBinary("ffmpeg", args).then(() => undefined);
}

/** Probe a media file's duration in seconds via ffprobe. */
export async function probeDurationSecs(path: string): Promise<number> {
  const out = await runBinary("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const secs = parseFloat(out.trim());
  if (!Number.isFinite(secs) || secs <= 0) {
    throw new Error(`ffprobe returned an invalid duration for ${path}: "${out.trim()}"`);
  }
  return secs;
}

function runBinary(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error(`${bin} not found — install ffmpeg and ensure it is on PATH.`));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}
