import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { renderVideoRow } from "@/lib/render";

export const dynamic = "force-dynamic";
// Rendering shells out to ffmpeg and can take a while — never prerender/cache.
export const maxDuration = 300;

/**
 * POST /api/render
 * Body: { video_id: string, include_short?: boolean }
 *
 * Renders the long-form (and optionally the 9:16 short) from the video's script,
 * stores the file path on video_url, and advances status to VIDEO_DONE.
 * Requires ffmpeg/ffprobe on PATH + ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.
 */
export async function POST(req: Request) {
  try {
    const { video_id, include_short, visual_source } = await req.json();
    if (!video_id) {
      return NextResponse.json({ success: false, error: "video_id required" }, { status: 400 });
    }
    const db = getServerClient();
    const result = await renderVideoRow(db, video_id, {
      includeShort: include_short === true,
      visualSource: visual_source === "pexels" ? "pexels" : "color",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
