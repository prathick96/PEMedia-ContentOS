import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/client";
import { createRun } from "@/lib/pipeline/runs";
import { executeRun } from "@/lib/pipeline/execute";
import type { NicheSlug } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
// The detached run can take minutes; this handler only creates the row and returns.
export const maxDuration = 300;

/**
 * POST /api/pipeline/start  Body: { niche?: string }
 *
 * Creates a pipeline_runs row and launches the full pipeline in the BACKGROUND,
 * returning the runId immediately. The run persists each stage to the DB, so the
 * client observes it by polling GET /api/pipeline/runs?id=<runId> — and a page
 * reload simply rehydrates from the same row instead of losing the run.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const niche = (typeof body?.niche === "string" && body.niche.trim() ? body.niche.trim() : "tech") as NicheSlug;

    const db = getServerClient();
    const run = await createRun(db, niche);

    // Fire-and-forget: detached from this request so it survives client reloads.
    void executeRun(run.id, niche).catch((e) =>
      console.error(`[pipeline] run ${run.id} crashed:`, e)
    );

    return NextResponse.json({ success: true, runId: run.id, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
