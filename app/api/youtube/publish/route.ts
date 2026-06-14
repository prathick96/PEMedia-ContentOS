import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { publishApprovedVideo, type PublishPrivacy } from "@/lib/publishing/youtube-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/youtube/publish
 * Body: { video_id: string, privacy?: 'private' | 'unlisted' | 'public' }
 *
 * Direct upload of a rendered video (retry path / first-test path). Defaults to
 * private — set the AI disclosure in YouTube Studio before making it public.
 */
export async function POST(req: Request) {
  try {
    const { video_id, privacy } = await req.json();
    if (!video_id) {
      return NextResponse.json({ success: false, error: "video_id required" }, { status: 400 });
    }
    const db = getServerClient();
    const result = await publishApprovedVideo(db, video_id, { privacy: privacy as PublishPrivacy });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
