/**
 * lib/pipeline/execute.ts
 *
 * Runs a full pipeline in the BACKGROUND, decoupled from any HTTP request, and
 * persists every stage transition to pipeline_runs. This is what makes a run
 * survive client reloads: the work is owned by the server, not the browser tab.
 *
 * Started fire-and-forget from POST /api/pipeline/start; observed via GET
 * /api/pipeline/runs polling. (Fire-and-forget relies on a long-lived Node process —
 * true for `next dev` / a node server. A serverless host would need a queue/worker;
 * that's the Phase-2 path noted in the council brief.)
 */

import { getServerClient } from "@/lib/db/client";
import type { NicheSlug } from "@/lib/db/schema";
import { runFullPipeline } from "./full-run";
import { deriveFinalStatus, finalizeRun, saveRunProgress } from "./runs";
import type { PipelineEvent } from "./stages";

export async function executeRun(runId: string, niche: NicheSlug): Promise<void> {
  const db = getServerClient();
  const events: PipelineEvent[] = [];
  let last: PipelineEvent | undefined;
  let videoId: string | undefined;

  try {
    for await (const event of runFullPipeline({ niche })) {
      events.push(event);
      last = event;
      const evVideoId = event.data?.video_id;
      if (typeof evVideoId === "string") videoId = evVideoId;
      await saveRunProgress(db, runId, events, event, videoId);
    }

    const status = deriveFinalStatus(last);
    const outputPath = videoId ? await lookupVideoPath(db, videoId) : null;
    await finalizeRun(db, runId, status, {
      videoId,
      outputPath,
      error: status === "failed" ? last?.detail ?? "Pipeline ended on a failure." : null,
    });
  } catch (err) {
    await finalizeRun(db, runId, "failed", {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** The stored absolute path of the rendered long-form, recorded on the run for reference. */
async function lookupVideoPath(
  db: ReturnType<typeof getServerClient>,
  videoId: string
): Promise<string | null> {
  const { data } = await db.from("videos").select("video_url").eq("id", videoId).maybeSingle();
  return (data as { video_url?: string } | null)?.video_url ?? null;
}
