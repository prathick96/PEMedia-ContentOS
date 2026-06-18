import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { getLatestRun, getRun } from "@/lib/pipeline/runs";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/runs?id=<runId>
 *
 * Returns one pipeline run (by id), or the most recent run when no id is given.
 * The Pipeline page calls this on mount to rehydrate, and polls it while a run is
 * active. Stale 'running' rows are reaped to 'failed' on read.
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const db = getServerClient();
    const run = id ? await getRun(db, id) : await getLatestRun(db);
    return NextResponse.json({ success: true, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
