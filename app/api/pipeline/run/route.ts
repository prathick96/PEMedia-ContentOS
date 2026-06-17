import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { runProductionPipeline } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
// Runs Production + render (ffmpeg) + QA + Publisher end to end — can take minutes.
export const maxDuration = 300;

/**
 * POST /api/pipeline/run
 * Body: { topic: string, series_id: string, include_short?: boolean, skip_render?: boolean }
 *
 * One trigger: Production → render → QA → Publisher. Stops at the human approval
 * gate; approving (Approvals page) uploads to YouTube via the Phase A bridge.
 */
export async function POST(req: Request) {
  try {
    const { topic, series_id, include_short, skip_render } = await req.json();
    if (!topic || !series_id) {
      return NextResponse.json(
        { success: false, error: "topic and series_id are required" },
        { status: 400 }
      );
    }
    const db = getServerClient();
    const result = await runProductionPipeline(db, topic, series_id, {
      includeShort: include_short === true,
      skipRender: skip_render === true,
    });
    return NextResponse.json({ success: result.completed, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
