import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { getValidAccessToken, uploadVideo } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * POST /api/youtube/test-upload
 * Body: { channel_id: string, video_path: string, title?: string, thumbnail_path?: string }
 *
 * Validates the full OAuth + resumable-upload path end-to-end by uploading a
 * local file as PRIVATE (so nothing goes public, and the altered-content
 * disclosure can be set in Studio first). Point video_path at any .mp4 you have.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channel_id, video_path, title, thumbnail_path } = body ?? {};
    if (!channel_id || !video_path) {
      return NextResponse.json(
        { success: false, error: "channel_id and video_path are required" },
        { status: 400 }
      );
    }

    const db = getServerClient();
    const accessToken = await getValidAccessToken(db, channel_id);

    const result = await uploadVideo(accessToken, {
      videoPath: video_path,
      title: title ?? "PEMedia connection test (private)",
      description:
        "Test upload validating the autonomous YouTube pipeline. Private. AI-assisted content.",
      tags: ["test"],
      privacyStatus: "private",
      thumbnailPath: thumbnail_path,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
