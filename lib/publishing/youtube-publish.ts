/**
 * lib/publishing/youtube-publish.ts
 *
 * The approve→upload bridge. The Publisher Agent prepares metadata and queues a
 * `publish_video` approval; nothing goes live until the operator approves. On
 * approval, this uploads the rendered file via the YouTube Data API.
 *
 * Council Brief 003: the altered-content (AI) disclosure can't be set via the
 * API, so uploads default to PRIVATE — the operator sets the disclosure in Studio
 * and flips it public. That human step is the safety gate until disclosure is
 * API-settable / QA has earned hands-off.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalAction, ApprovalStatus } from "@/lib/approvals";
import { getValidAccessToken, uploadVideo } from "@/lib/youtube";

export type PublishPrivacy = "private" | "unlisted" | "public";

export interface PublishResult {
  youtubeId: string;
  url: string;
  privacyStatus: PublishPrivacy;
  requiresStudioDisclosure: boolean;
  /** The DB status applied to the video row. */
  status: "PUBLISHED" | "SCHEDULED";
}

/**
 * Pure: which DB status a freshly-uploaded video should take. Public = live now
 * (PUBLISHED). Private/unlisted = staged on YouTube, awaiting the operator to set
 * the disclosure and publish (SCHEDULED).
 */
export function resolvePublishedStatus(privacy: PublishPrivacy): "PUBLISHED" | "SCHEDULED" {
  return privacy === "public" ? "PUBLISHED" : "SCHEDULED";
}

/** Pure: should resolving this approval trigger an upload? */
export function shouldAutoPublishOnApproval(
  action: ApprovalAction | string,
  decision: ApprovalStatus | string
): boolean {
  return action === "publish_video" && decision === "approved";
}

interface VideoRow {
  id: string;
  title: string | null;
  topic: string;
  description: string | null;
  tags: string[] | null;
  video_url: string | null;
  thumbnail_url: string | null;
  youtube_id: string | null;
  series: { channels?: { id?: string } } | null;
}

/**
 * Upload an approved, rendered video to its channel's YouTube. Idempotent: if the
 * row already has a youtube_id, it refuses rather than double-uploading.
 */
export async function publishApprovedVideo(
  db: SupabaseClient,
  videoId: string,
  opts: { privacy?: PublishPrivacy } = {}
): Promise<PublishResult> {
  const privacy = opts.privacy ?? "private";

  const { data } = await db
    .from("videos")
    .select("id, title, topic, description, tags, video_url, thumbnail_url, youtube_id, series(channels(id))")
    .eq("id", videoId)
    .single();
  const video = data as VideoRow | null;

  if (!video) throw new Error(`Video ${videoId} not found`);
  if (video.youtube_id) {
    throw new Error(`Video ${videoId} is already on YouTube (id ${video.youtube_id}) — refusing to re-upload.`);
  }
  if (!video.video_url) {
    throw new Error(`Video ${videoId} has no rendered file — run /api/render first.`);
  }
  const channelId = video.series?.channels?.id;
  if (!channelId) {
    throw new Error(`Video ${videoId} has no linked channel — cannot resolve YouTube credentials.`);
  }

  const accessToken = await getValidAccessToken(db, channelId);
  const result = await uploadVideo(accessToken, {
    videoPath: video.video_url,
    title: video.title ?? video.topic,
    description: video.description ?? "",
    tags: video.tags ?? [],
    privacyStatus: privacy,
    thumbnailPath: video.thumbnail_url ?? undefined,
  });

  const status = resolvePublishedStatus(privacy);
  await db
    .from("videos")
    .update({
      youtube_id: result.videoId,
      status,
      published_at: status === "PUBLISHED" ? new Date().toISOString() : null,
    })
    .eq("id", videoId);

  return {
    youtubeId: result.videoId,
    url: result.url,
    privacyStatus: privacy,
    requiresStudioDisclosure: result.requiresStudioDisclosure,
    status,
  };
}
