/**
 * lib/pipeline/run.ts
 *
 * The production pipeline: one call runs Production → render → QA → Publisher.
 * It stops at the Publisher's human approval gate (Council Brief 003 — nothing
 * uploads without sign-off; the approve→upload bridge in lib/publishing handles
 * the rest). Every step is recorded so a partial run is fully diagnosable.
 *
 * Short-circuits: a failed step or a QA `reject` halts the chain and reports why.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductionAgent } from "@/lib/agents/production";
import { QAReviewerAgent } from "@/lib/agents/qa-reviewer";
import { PublisherAgent } from "@/lib/agents/publisher";
import { renderVideoRow } from "@/lib/render";
import type { QADecision } from "@/lib/qa-review";

export type PipelineStepName = "production" | "render" | "qa" | "publisher";

export interface PipelineStepResult {
  step: PipelineStepName;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface PipelineResult {
  topic: string;
  seriesId: string;
  videoId?: string;
  /** True when the chain reached the Publisher (now awaiting human approval). */
  completed: boolean;
  stoppedAt?: PipelineStepName;
  reason?: string;
  steps: PipelineStepResult[];
}

export interface PipelineOptions {
  /** Also render the 9:16 short. */
  includeShort?: boolean;
  renderBackgroundColor?: string;
  /** Skip the render step (assets produced elsewhere / chain-only testing). */
  skipRender?: boolean;
}

/** Pure: after QA, do we proceed to the Publisher? Only a `reject` halts the chain. */
export function shouldProceedAfterQa(decision: QADecision): boolean {
  return decision !== "reject";
}

export async function runProductionPipeline(
  db: SupabaseClient,
  topic: string,
  seriesId: string,
  opts: PipelineOptions = {}
): Promise<PipelineResult> {
  const steps: PipelineStepResult[] = [];
  const result: PipelineResult = { topic, seriesId, completed: false, steps };
  const halt = (step: PipelineStepName, reason?: string): PipelineResult => {
    result.stoppedAt = step;
    result.reason = reason;
    return result;
  };

  // 1. Production — script + 9:16 short_cut, quality-gated.
  const prod = await new ProductionAgent().run({ topic, series_id: seriesId });
  steps.push({ step: "production", ok: prod.success, data: prod.data, error: prod.error });
  if (!prod.success) return halt("production", prod.error);
  const videoId = prod.data?.video_id as string | undefined;
  result.videoId = videoId;
  if (!videoId) return halt("production", "Production returned no video_id");

  // 2. Render → MP4 (voice + captions + background), unless skipped.
  if (!opts.skipRender) {
    try {
      const render = await renderVideoRow(db, videoId, {
        includeShort: opts.includeShort,
        backgroundColor: opts.renderBackgroundColor,
      });
      steps.push({
        step: "render",
        ok: true,
        data: {
          videoPath: render.longForm.videoPath,
          durationSecs: render.longForm.durationSecs,
          renderedShort: Boolean(render.short),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({ step: "render", ok: false, error: message });
      return halt("render", message);
    }
  }

  // 3. QA review — gates advancement; a reject halts here.
  const qa = await new QAReviewerAgent().run({ video_id: videoId });
  steps.push({ step: "qa", ok: qa.success, data: qa.data, error: qa.error });
  if (!qa.success) return halt("qa", qa.error);
  const qaDecision = (qa.data?.qa as { decision?: QADecision } | undefined)?.decision ?? "reject";
  if (!shouldProceedAfterQa(qaDecision)) return halt("qa", `QA decision: ${qaDecision}`);

  // 4. Publisher — optimises metadata and queues the publish_video approval.
  const pub = await new PublisherAgent().run({ video_id: videoId });
  steps.push({ step: "publisher", ok: pub.success, data: pub.data, error: pub.error });
  if (!pub.success) return halt("publisher", pub.error);

  result.completed = true;
  return result;
}
