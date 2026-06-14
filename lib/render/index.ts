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
import { tmpdir } from "os";
import { join } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShortCut, VideoScript } from "@/lib/db/schema";
import { buildRenderPlan, buildShortRenderPlan } from "./plan";
import { buildSrt } from "./captions";
import { buildRenderArgs, probeDurationSecs, runFfmpeg } from "./ffmpeg";
import { synthesizeNarration } from "./voice";
import { generateThumbnail } from "./thumbnail";
import type { RenderOptions, RenderPlan, RenderResult } from "./types";

async function renderTimeline(plan: RenderPlan, opts: RenderOptions): Promise<RenderResult> {
  const dir = opts.outputDir || join(tmpdir(), "pemedia-render");
  await mkdir(dir, { recursive: true });
  const stamp = Date.now();
  const audioPath = join(dir, `narration-${stamp}.mp3`);
  const srtPath = join(dir, `captions-${stamp}.srt`);
  const outputPath = join(dir, `video-${stamp}.mp4`);

  const audio = await synthesizeNarration(plan.narration, opts);
  await writeFile(audioPath, audio);

  const durationSecs = await probeDurationSecs(audioPath);
  await writeFile(srtPath, buildSrt(plan.scenes, durationSecs), "utf8");

  await runFfmpeg(buildRenderArgs({ audioPath, srtPath, plan, outputPath }));

  return {
    videoPath: outputPath,
    durationSecs,
    width: plan.width,
    height: plan.height,
    sceneCount: plan.scenes.length,
  };
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
