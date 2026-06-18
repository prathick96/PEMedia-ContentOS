/**
 * lib/pipeline/runs.ts
 *
 * Persistence for a full pipeline run (migration 008 — pipeline_runs). This is the
 * source of truth that makes a run survive browser reloads: the executor writes
 * every stage transition here, and the Pipeline page reads/polls it.
 *
 * The DB calls are thin; the decision logic (final status, staleness) is pure and
 * unit-tested.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineEvent, PipelineStageId } from "./stages";

export type RunStatus = "running" | "completed" | "failed" | "awaiting_approval";

export interface PipelineRun {
  id: string;
  niche: string;
  status: RunStatus;
  current_stage: PipelineStageId | null;
  stages: PipelineEvent[];
  video_id: string | null;
  output_path: string | null;
  error: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

/** A 'running' row not touched in this long is presumed dead (e.g. server restart). */
export const STALE_RUN_MS = 30 * 60 * 1000;

const TABLE = "pipeline_runs";

// ─── Pure decision logic (unit-tested) ───────────────────────────────────────

/**
 * Terminal status for a run whose generator has finished, derived from its last
 * event. A non-terminal mid-run "failed" (e.g. render, which the pipeline continues
 * past) is never the last event, so it can't mislead this.
 */
export function deriveFinalStatus(lastEvent: PipelineEvent | undefined): RunStatus {
  if (!lastEvent) return "failed";
  if (lastEvent.status === "awaiting_approval") return "awaiting_approval";
  if (lastEvent.status === "failed") return "failed";
  return "completed";
}

/** True once a status is terminal (the UI can stop polling). */
export function isTerminal(status: RunStatus): boolean {
  return status !== "running";
}

/** Pure: is a still-"running" row stale enough to reap? */
export function isStaleRun(
  run: Pick<PipelineRun, "status" | "updated_at">,
  now: number = Date.now()
): boolean {
  return run.status === "running" && now - new Date(run.updated_at).getTime() > STALE_RUN_MS;
}

// ─── DB operations ───────────────────────────────────────────────────────────

export async function createRun(db: SupabaseClient, niche: string): Promise<PipelineRun> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ niche, status: "running", stages: [] })
    .select()
    .single();
  if (error) throw new Error(`Failed to create pipeline run: ${error.message}`);
  return data as PipelineRun;
}

/**
 * Persist the run's progress: rewrite the full ordered event log and point at the
 * current stage. The executor owns the array in memory and passes it whole, so this
 * is a single write per stage (no read-modify-write race).
 */
export async function saveRunProgress(
  db: SupabaseClient,
  runId: string,
  events: PipelineEvent[],
  current: PipelineEvent,
  videoId?: string
): Promise<void> {
  await db
    .from(TABLE)
    .update({
      stages: events,
      current_stage: current.stage,
      updated_at: new Date().toISOString(),
      ...(videoId ? { video_id: videoId } : {}),
    })
    .eq("id", runId);
}

export async function finalizeRun(
  db: SupabaseClient,
  runId: string,
  status: RunStatus,
  extra: { videoId?: string; outputPath?: string | null; error?: string | null } = {}
): Promise<void> {
  await db
    .from(TABLE)
    .update({
      status,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(extra.videoId ? { video_id: extra.videoId } : {}),
      ...(extra.outputPath !== undefined ? { output_path: extra.outputPath } : {}),
      ...(extra.error !== undefined ? { error: extra.error } : {}),
    })
    .eq("id", runId);
}

/** Mark any 'running' row with no recent update as failed (zombie guard). */
export async function reapStaleRuns(db: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString();
  await db
    .from(TABLE)
    .update({
      status: "failed",
      error: "Run went stale — its background task ended (likely a dev-server restart).",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("updated_at", cutoff);
}

export async function getRun(db: SupabaseClient, id: string): Promise<PipelineRun | null> {
  await reapStaleRuns(db);
  const { data } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
  return (data as PipelineRun | null) ?? null;
}

/** The most recent run (what the Pipeline page rehydrates on load). */
export async function getLatestRun(db: SupabaseClient): Promise<PipelineRun | null> {
  await reapStaleRuns(db);
  const { data } = await db
    .from(TABLE)
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PipelineRun | null) ?? null;
}
