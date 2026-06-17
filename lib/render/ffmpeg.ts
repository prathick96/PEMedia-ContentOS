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
import { basename } from "path";
import type { RenderPlan } from "./types";

/**
 * The value for the subtitles filter. We pass the SRT's BARE FILENAME and run
 * ffmpeg with cwd set to the render directory (see runFfmpeg's cwd option), so no
 * Windows drive-letter colon or backslash ever reaches the filtergraph.
 *
 * Escaping `C:\…` inside the subtitles filter is notoriously fragile and varies by
 * ffmpeg version: a single-backslash colon (`C\:/…`) makes newer ffmpeg (libass)
 * split on the colon and try to read the path tail as the `original_size` option —
 * "Unable to parse 'original_size' option value … as image size". The bare filename
 * sidesteps the whole escaping problem. Only `'` needs escaping in a filename.
 */
export function subtitlesFilterName(srtPath: string): string {
  return basename(srtPath).replace(/'/g, "\\'");
}

const FORCE_STYLE =
  "FontSize=22,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Outline=2,Shadow=1,Alignment=2,MarginV=72,Bold=1";

/** libx264 speed preset — `veryfast` is visually identical for flat backgrounds. */
const X264_PRESET = process.env.FFMPEG_PRESET || "veryfast";

/**
 * Render framerate. This is the dominant cost: the bottleneck isn't x264 (a static
 * background is trivial to encode) but the per-frame libass subtitle compositing,
 * which runs ~1× realtime at 30fps — so a 13-min video takes ~13 min. Our visuals
 * are a still background where only the captions change every ~1–2s, so 15fps looks
 * identical and roughly halves the frame count (measured ~3× faster end to end).
 * Override with FFMPEG_FPS if a future motion-heavy visual style needs more.
 */
const RENDER_FPS = Number(process.env.FFMPEG_FPS) || 15;

export function buildSubtitlesFilter(srtPath: string): string {
  return `subtitles=${subtitlesFilterName(srtPath)}:force_style='${FORCE_STYLE}'`;
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
    "-i", `color=c=${plan.backgroundColor}:s=${plan.width}x${plan.height}:r=${RENDER_FPS}`,
    "-i", audioPath,
    "-vf", buildSubtitlesFilter(srtPath),
    "-c:v", "libx264",
    "-preset", X264_PRESET,
    "-tune", "stillimage",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    outputPath,
  ];
}

// ── B-roll slideshow (opt-in) ────────────────────────────────────────────────
// Each scene image becomes a fixed-size clip (robust to mixed source sizes), then
// the clips are concatenated and muxed with audio + burned captions.

export interface ImageClipInput {
  imagePath: string;
  outputPath: string;
  durationSecs: number;
  width: number;
  height: number;
}

/** Pure: ffmpeg argv to turn a still image into a WxH clip of a given duration. */
export function buildImageClipArgs(input: ImageClipInput): string[] {
  return [
    "-y",
    "-loop", "1",
    "-i", input.imagePath,
    "-t", input.durationSecs.toFixed(3),
    "-vf",
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},format=yuv420p`,
    "-r", String(RENDER_FPS),
    "-c:v", "libx264",
    "-preset", X264_PRESET,
    "-pix_fmt", "yuv420p",
    "-an",
    input.outputPath,
  ];
}

/** Pure: a concat-demuxer list file body for the given clip paths. */
export function buildConcatListContent(clipPaths: string[]): string {
  return clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
}

export interface AudioConcatInput {
  concatListPath: string;
  outputPath: string;
}

/**
 * Pure: ffmpeg argv to concatenate same-codec MP3 chunks losslessly via the concat
 * demuxer (-c copy). Used to join the per-chunk narration produced when a long
 * script is split under ElevenLabs' 10k-char per-request limit.
 */
export function buildAudioConcatArgs({ concatListPath, outputPath }: AudioConcatInput): string[] {
  return ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", outputPath];
}

export interface BrollFinalInput {
  concatListPath: string;
  audioPath: string;
  srtPath: string;
  outputPath: string;
}

/** Pure: ffmpeg argv to concat the clips, mux narration, and burn captions. */
export function buildBrollFinalArgs(input: BrollFinalInput): string[] {
  return [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", input.concatListPath,
    "-i", input.audioPath,
    "-vf", buildSubtitlesFilter(input.srtPath),
    "-c:v", "libx264",
    "-preset", X264_PRESET,
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    input.outputPath,
  ];
}

export interface FfmpegRunOptions {
  /**
   * Working directory for the process. Set to the render dir so the subtitles
   * filter can reference the SRT by bare filename (see subtitlesFilterName) —
   * this is what keeps Windows path escaping out of the filtergraph entirely.
   */
  cwd?: string;
}

/** Run ffmpeg with the given args. Rejects with stderr tail on non-zero exit. */
export function runFfmpeg(args: string[], opts: FfmpegRunOptions = {}): Promise<void> {
  return runBinary("ffmpeg", args, opts).then(() => undefined);
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

function runBinary(bin: string, args: string[], opts: FfmpegRunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, opts.cwd ? { cwd: opts.cwd } : {});
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
