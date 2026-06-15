/**
 * lib/pipeline/stages.ts
 *
 * Shared, dependency-free pipeline vocabulary — imported by both the server
 * orchestrator (full-run.ts) and the client UI (PipelineRunner.tsx). Keep this
 * file free of server imports so it stays safe in the client bundle.
 */

export type PipelineStageId =
  | "scout"
  | "ceo_check"
  | "creative"
  | "production"
  | "render"
  | "qa"
  | "publisher";

/** "pending" is the UI's initial state; the server only emits the rest. */
export type StageStatus = "pending" | "running" | "done" | "skipped" | "awaiting_approval" | "failed";

export interface PipelineEvent {
  stage: PipelineStageId;
  status: Exclude<StageStatus, "pending">;
  detail?: string;
  data?: Record<string, unknown>;
  at: string;
}

/** Canonical ordered stages, for rendering the tracker and the run sequence. */
export const PIPELINE_STAGES: { id: PipelineStageId; label: string; hint: string }[] = [
  { id: "scout", label: "Scout", hint: "Trend discovery" },
  { id: "ceo_check", label: "CEO Check", hint: "Council confidence gate" },
  { id: "creative", label: "Creative", hint: "Channel & brand" },
  { id: "production", label: "Production", hint: "Script + short cut" },
  { id: "render", label: "Render", hint: "Voice + captions + thumbnail" },
  { id: "qa", label: "QA Reviewer", hint: "Quality gate" },
  { id: "publisher", label: "Publisher", hint: "Schedule & approval" },
];

export interface ScoredTopicLike {
  topic: string;
  score?: number;
  suggested_series_type?: string;
}

/** Pure: the highest-scoring topic from a niche's Scout briefing. */
export function pickTopTopic(list: ScoredTopicLike[] | undefined): ScoredTopicLike | null {
  if (!list || list.length === 0) return null;
  return [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}
