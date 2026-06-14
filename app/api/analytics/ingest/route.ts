import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { ingestChannelAnalytics } from "@/lib/analytics/ingest";

export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/ingest
 * Body: { channel_id: string, date?: "YYYY-MM-DD" }
 *
 * Pulls the channel's latest YouTube stats into analytics_snaps + video_analytics.
 * Idempotent per (channel, date). Wire to the daily cron for an automatic loop.
 */
export async function POST(req: Request) {
  try {
    const { channel_id, date } = await req.json();
    if (!channel_id) {
      return NextResponse.json({ success: false, error: "channel_id required" }, { status: 400 });
    }
    const db = getServerClient();
    const result = await ingestChannelAnalytics(db, channel_id, date);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
