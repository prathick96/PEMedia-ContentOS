/**
 * lib/render/index.ts — render orchestration.
 *
 *   renderVideo(script)      → 16:9 long-form MP4
 *   renderShort(short_cut)   → 9:16 short MP4
 *   renderVideoRow(db, id)   → renders from a video row, stores video_url + VIDEO_DONE
 *
 * Prerequisites: ffmpeg + ffprobe on PATH; ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShortCut, VideoScript } from "@/lib/db/schema";
import { resolveRenderDir } from "./output-dir";
import { buildRenderPlan, buildShortRenderPlan } from "./plan";
import { computeSceneDurations } from "./plan";
import { buildSrt, mergeTimedChunks, wordsToSrt, type TimedWord } from "./captions";
import {
  buildAudioConcatArgs,
  buildBrollFinalArgs,
  buildColorClipArgs,
  buildConcatListContent,
  buildKenBurnsClipArgs,
  buildRenderArgs,
  buildVideoClipArgs,
  probeDurationSecs,
  runFfmpeg,
} from "./ffmpeg";
import {
  buildPexelsQuery,
  downloadToFile,
  fetchScenePhotos,
  fetchSceneVideos,
  photoUrl,
  pickBestPhoto,
  pickBestVideoFile,
} from "./visuals";
import {
  synthesizeNarrationChunks,
  synthesizeNarrationTimedChunks,
  type NarrationChunk,
} from "./voice";
import { generateThumbnail } from "./thumbnail";
import type { Aspect, RenderOptions, RenderPlan, RenderResult } from "./types";

async function renderTimeline(plan: RenderPlan, opts: RenderOptions): Promise<RenderResult> {
  const stamp = Date.now();
  // Stable, configurable output dir (CONTENT_OUTPUT_DIR) — not OS temp, so finished
  // videos persist. Per-render subdir isolates artifacts; the final path goes to the DB.
  const dir = opts.outputDir || resolveRenderDir(stamp);
  await mkdir(dir, { recursive: true });
  const audioPath = join(dir, `narration-${stamp}.mp3`);
  const srtPath = join(dir, `captions-${stamp}.srt`);
  const outputPath = join(dir, `video-${stamp}.mp4`);

  // Synthesize narration. Long scripts exceed ElevenLabs' 10k-char per-request
  // limit, so voice.* splits on sentence boundaries into sub-limit chunks; here we
  // concatenate the chunk audio losslessly and stitch the per-chunk word timings
  // into one timeline. Prefer word-synced (timestamped) captions; fall back to
  // plain TTS + proportional scene captions if the timestamped call is unavailable.
  let timedChunks: NarrationChunk[] | null = null;
  let chunkAudios: Buffer[];
  try {
    timedChunks = await synthesizeNarrationTimedChunks(plan.narration, opts);
    chunkAudios = timedChunks.map((c) => c.audio);
  } catch (err) {
    console.warn(
      "[render] timestamped TTS failed, falling back to plain TTS:",
      err instanceof Error ? err.message : err
    );
    chunkAudios = await synthesizeNarrationChunks(plan.narration, opts);
  }

  const chunkPaths = await writeNarrationAudio(chunkAudios, audioPath, dir, stamp);
  const durationSecs = await probeDurationSecs(audioPath);

  // Word timings: offset each chunk's local timings by the preceding chunks' real
  // (probed) durations so captions line up with the concatenated audio.
  let words: TimedWord[] = [];
  if (timedChunks) {
    if (timedChunks.length === 1) {
      words = timedChunks[0].words;
    } else {
      const durations = await Promise.all(chunkPaths.map((p) => probeDurationSecs(p)));
      words = mergeTimedChunks(
        timedChunks.map((c, i) => ({ words: c.words, duration: durations[i] }))
      );
    }
  }

  const srt = words.length > 0 ? wordsToSrt(words) : buildSrt(plan.scenes, durationSecs);
  await writeFile(srtPath, srt, "utf8");

  // Visuals: real stock b-roll is now the DEFAULT whenever a Pexels key is present
  // (each scene → stock video → still+Ken Burns → color card, all per-scene resilient).
  // Pass visualSource: "color" to force the flat brand card; any whole-path failure
  // also degrades cleanly to it.
  const useBroll = opts.visualSource !== "color" && Boolean(process.env.PEXELS_API_KEY);
  let assembled = false;
  if (useBroll) {
    try {
      await renderBrollVideo({ plan, durationSecs, audioPath, srtPath, outputPath, dir, stamp });
      assembled = true;
    } catch (err) {
      console.warn(
        "[render] b-roll path failed, falling back to color background:",
        err instanceof Error ? err.message : err
      );
    }
  }
  if (!assembled) {
    // cwd = dir so the subtitles filter resolves the SRT by bare filename.
    await runFfmpeg(buildRenderArgs({ audioPath, srtPath, plan, outputPath }), { cwd: dir });
  }

  return {
    videoPath: outputPath,
    durationSecs,
    width: plan.width,
    height: plan.height,
    sceneCount: plan.scenes.length,
  };
}

/**
 * Persist narration chunk audio to `audioPath` and return the per-chunk file paths
 * (used to probe per-chunk durations for caption stitching).
 *
 * - 1 chunk  → written straight to audioPath (no ffmpeg needed).
 * - N chunks → each written to its own mp3, then concatenated losslessly into
 *   audioPath via the ffmpeg concat demuxer (-c copy; all chunks share a codec).
 */
async function writeNarrationAudio(
  chunkAudios: Buffer[],
  audioPath: string,
  dir: string,
  stamp: number
): Promise<string[]> {
  if (chunkAudios.length === 1) {
    await writeFile(audioPath, chunkAudios[0]);
    return [audioPath];
  }

  const chunkPaths: string[] = [];
  for (let i = 0; i < chunkAudios.length; i++) {
    const p = join(dir, `narration-${stamp}-${i}.mp3`);
    await writeFile(p, chunkAudios[i]);
    chunkPaths.push(p);
  }

  const listPath = join(dir, `narration-concat-${stamp}.txt`);
  await writeFile(listPath, buildConcatListContent(chunkPaths), "utf8");
  await runFfmpeg(buildAudioConcatArgs({ concatListPath: listPath, outputPath: audioPath }));
  return chunkPaths;
}

/**
 * Assemble the video from per-scene visuals timed to the narration. Each scene tries,
 * in order: a Pexels stock VIDEO clip → a still photo with Ken Burns motion → a solid
 * color card. Every step is isolated, so a scene with no stock never aborts the run.
 */
async function renderBrollVideo(args: {
  plan: RenderPlan;
  durationSecs: number;
  audioPath: string;
  srtPath: string;
  outputPath: string;
  dir: string;
  stamp: number;
}): Promise<void> {
  const { plan, durationSecs, audioPath, srtPath, outputPath, dir, stamp } = args;
  const aspect: Aspect = plan.width >= plan.height ? "16:9" : "9:16";
  const durations = computeSceneDurations(plan.scenes, durationSecs);

  const clipPaths: string[] = [];
  for (let i = 0; i < plan.scenes.length; i++) {
    clipPaths.push(
      await renderSceneClip({
        query: buildPexelsQuery(plan.scenes[i].text, plan.scenes[i].keywords),
        aspect,
        durationSecs: durations[i],
        clipPath: join(dir, `clip-${stamp}-${i}.mp4`),
        srcBase: join(dir, `src-${stamp}-${i}`),
        width: plan.width,
        height: plan.height,
        backgroundColor: plan.backgroundColor,
      })
    );
  }

  const concatListPath = join(dir, `concat-${stamp}.txt`);
  await writeFile(concatListPath, buildConcatListContent(clipPaths), "utf8");
  // cwd = dir so the subtitles filter resolves the SRT by bare filename.
  await runFfmpeg(buildBrollFinalArgs({ concatListPath, audioPath, srtPath, outputPath }), { cwd: dir });
}

/**
 * Produce one scene clip, degrading per-scene: Pexels stock VIDEO → still photo with
 * Ken Burns motion → solid color card. Never throws — a scene always yields a clip.
 */
async function renderSceneClip(s: {
  query: string;
  aspect: Aspect;
  durationSecs: number;
  clipPath: string;
  srcBase: string;
  width: number;
  height: number;
  backgroundColor: string;
}): Promise<string> {
  const warn = (what: string, err: unknown) =>
    console.warn(`[render] ${what} for "${s.query}":`, err instanceof Error ? err.message : err);

  // 1. Stock video — real motion, the best free option.
  try {
    const pick = pickBestVideoFile(await fetchSceneVideos(s.query, s.aspect), s.aspect);
    if (pick) {
      const srcPath = `${s.srcBase}.mp4`;
      await downloadToFile(pick.url, srcPath);
      await runFfmpeg(
        buildVideoClipArgs({
          videoPath: srcPath,
          outputPath: s.clipPath,
          durationSecs: s.durationSecs,
          width: s.width,
          height: s.height,
        })
      );
      return s.clipPath;
    }
  } catch (err) {
    warn("stock video failed", err);
  }

  // 2. Still photo with Ken Burns motion.
  try {
    const photo = pickBestPhoto(await fetchScenePhotos(s.query, s.aspect), s.aspect);
    if (photo) {
      const imgPath = `${s.srcBase}.jpg`;
      await downloadToFile(photoUrl(photo), imgPath);
      await runFfmpeg(
        buildKenBurnsClipArgs({
          imagePath: imgPath,
          outputPath: s.clipPath,
          durationSecs: s.durationSecs,
          width: s.width,
          height: s.height,
        })
      );
      return s.clipPath;
    }
  } catch (err) {
    warn("still photo failed", err);
  }

  // 3. Solid color card — guaranteed last resort so the video always assembles.
  await runFfmpeg(
    buildColorClipArgs({
      outputPath: s.clipPath,
      durationSecs: s.durationSecs,
      width: s.width,
      height: s.height,
      backgroundColor: s.backgroundColor,
    })
  );
  return s.clipPath;
}

function withVoiceSettings(opts: RenderOptions, script: VideoScript): RenderOptions {
  const s = script.voice_direction?.elevenlabs_settings;
  return {
    ...opts,
    stability: opts.stability ?? s?.stability,
    similarityBoost: opts.similarityBoost ?? s?.similarity_boost,
  };
}

export async function renderVideo(script: VideoScript, opts: RenderOptions = {}): Promise<RenderResult> {
  const merged = withVoiceSettings(opts, script);
  return renderTimeline(buildRenderPlan(script, merged), merged);
}

export async function renderShort(short: ShortCut, opts: RenderOptions = {}): Promise<RenderResult> {
  const merged: RenderOptions = { ...opts, aspect: "9:16" };
  return renderTimeline(buildShortRenderPlan(short, merged), merged);
}

export interface RenderVideoRowOptions extends RenderOptions {
  /** Also render the 9:16 short from script.short_cut. */
  includeShort?: boolean;
}

/**
 * Render the long-form (and optionally the short) for a video row, then store the
 * long-form path on video_url and advance status to VIDEO_DONE.
 */
export async function renderVideoRow(
  db: SupabaseClient,
  videoId: string,
  opts: RenderVideoRowOptions = {}
): Promise<{ longForm: RenderResult; short?: RenderResult }> {
  const { data: video } = await db
    .from("videos")
    .select("*, series(channels(brand_doc))")
    .eq("id", videoId)
    .single();
  if (!video) throw new Error(`Video ${videoId} not found`);

  const script = video.script as VideoScript | null;
  if (!script) throw new Error(`Video ${videoId} has no script to render`);

  const series = video.series as
    | { channels?: { brand_doc?: { brand_colors?: { primary?: string } } } }
    | null;
  const backgroundColor = opts.backgroundColor ?? series?.channels?.brand_doc?.brand_colors?.primary;

  const longForm = await renderVideo(script, { ...opts, backgroundColor });

  let short: RenderResult | undefined;
  if (opts.includeShort && script.short_cut?.narration) {
    short = await renderShort(script.short_cut, { ...opts, backgroundColor });
  }

  // Thumbnail — best-effort: a failure here must not waste the rendered video.
  let thumbnailUrl: string | null = null;
  try {
    const fallback = (video.title as string) ?? script.title_options?.[0] ?? (video.topic as string) ?? "";
    thumbnailUrl = await generateThumbnail(script.thumbnail_concept, fallback, {
      backgroundColor,
      outputDir: opts.outputDir,
    });
  } catch (err) {
    console.warn("[render] thumbnail generation failed:", err instanceof Error ? err.message : err);
  }

  await db
    .from("videos")
    .update({ video_url: longForm.videoPath, thumbnail_url: thumbnailUrl, status: "VIDEO_DONE" })
    .eq("id", videoId);

  return { longForm, short };
}

export type { RenderResult, RenderPlan, RenderOptions } from "./types";
