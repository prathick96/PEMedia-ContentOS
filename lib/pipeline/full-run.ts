/**
 * lib/pipeline/full-run.ts
 *
 * The full empire run: one trigger drives every agent, start to finish —
 *   Scout → CEO confidence check → Creative → Production → Render → QA → Publisher
 * — as an async generator that yields a progress event per stage. The SSE route
 * streams those events so the Pipeline screen can visualize the run in realtime.
 *
 * Human gates are surfaced (not failures): a fresh channel pauses at Creative for
 * the launch approval; the finished video pauses at Publisher for the publish
 * approval. Render is non-fatal — QA reviews the script even if media isn't set up.
 */

import { getServerClient } from "@/lib/db/client";
import type { AgentOutput } from "@/lib/agents/base";
import { ScoutAgent } from "@/lib/agents/scout";
import { CreativeAgent } from "@/lib/agents/creative";
import { ProductionAgent } from "@/lib/agents/production";
import { QAReviewerAgent } from "@/lib/agents/qa-reviewer";
import { PublisherAgent } from "@/lib/agents/publisher";
import { reviewGate } from "@/lib/council";
import { renderVideoRow } from "@/lib/render";
import type { NicheSlug } from "@/lib/db/schema";
import {
  pickTopTopic,
  type PipelineEvent,
  type PipelineStageId,
  type ScoredTopicLike,
} from "./stages";

const ev = (
  stage: PipelineStageId,
  status: PipelineEvent["status"],
  detail?: string,
  data?: Record<string, unknown>
): PipelineEvent => ({ stage, status, detail, data, at: new Date().toISOString() });

/** Run an agent, converting a thrown error into a normal failure result. */
async function safeRun(fn: () => Promise<AgentOutput>): Promise<AgentOutput> {
  try {
    return await fn();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface FullRunOptions {
  niche?: NicheSlug;
}

export async function* runFullPipeline(opts: FullRunOptions = {}): AsyncGenerator<PipelineEvent> {
  const niche = (opts.niche ?? "tech") as NicheSlug;
  const db = getServerClient();

  const { data: nicheRow } = await db.from("niches").select("id").eq("slug", niche).maybeSingle();
  if (!nicheRow) {
    yield ev("scout", "failed", `Unknown niche "${niche}" — is the niches table seeded?`);
    return;
  }
  const nicheId = (nicheRow as { id: string }).id;

  // ── 1. Scout ───────────────────────────────────────────────────────────────
  yield ev("scout", "running", `Scanning live trends for ${niche}…`);
  const scout = await safeRun(() => new ScoutAgent().run({ niches: [niche] }));
  if (!scout.success) {
    yield ev("scout", "failed", scout.error);
    return;
  }
  const briefing = (scout.data?.briefing as Record<string, ScoredTopicLike[]> | undefined)?.[niche];
  const top = pickTopTopic(briefing);
  if (!top) {
    yield ev("scout", "failed", "Scout returned no topics");
    return;
  }
  yield ev("scout", "done", `Top topic: ${top.topic}`, { topic: top.topic, score: top.score });

  // ── 2. CEO confidence check (council topic_greenlight gate) ─────────────────
  yield ev("ceo_check", "running", "Council weighing confidence…");
  try {
    const verdict = await reviewGate("topic_greenlight", { topic: top.topic, niche, score: top.score });
    if (!verdict.approved) {
      yield ev("ceo_check", "failed", `Not greenlit (${Math.round(verdict.confidence * 100)}%): ${verdict.rationale}`);
      return;
    }
    yield ev("ceo_check", "done", `Greenlit at ${Math.round(verdict.confidence * 100)}% — ${verdict.rationale}`);
  } catch (e) {
    yield ev("ceo_check", "failed", e instanceof Error ? e.message : String(e));
    return;
  }

  // ── 3. Creative — ensure a channel + series exist ───────────────────────────
  yield ev("creative", "running", "Resolving channel & brand…");
  const { data: channel } = await db
    .from("channels")
    .select("id, name")
    .eq("niche_id", nicheId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!channel) {
    const created = await safeRun(() => new CreativeAgent().run({ niche, niche_id: nicheId }));
    if (!created.success) {
      yield ev("creative", "failed", created.error);
      return;
    }
    yield ev(
      "creative",
      "awaiting_approval",
      "New channel created — approve the launch on the Approvals page, then start the pipeline again.",
      { channel_id: created.data?.channel_id }
    );
    return;
  }

  const channelName = (channel as { id: string; name: string }).name;
  const channelId = (channel as { id: string }).id;
  const { data: series } = await db
    .from("series")
    .select("id, name")
    .eq("channel_id", channelId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!series) {
    yield ev("creative", "failed", `Channel "${channelName}" has no active series`);
    return;
  }
  const seriesId = (series as { id: string; name: string }).id;
  yield ev("creative", "done", `Using ${channelName} · ${(series as { name: string }).name}`, {
    channel_id: channelId,
    series_id: seriesId,
  });

  // ── 4. Production — script + 9:16 short cut (quality-gated internally) ───────
  yield ev("production", "running", "Writing the script & short cut…");
  const prod = await safeRun(() => new ProductionAgent().run({ topic: top.topic, series_id: seriesId }));
  if (!prod.success) {
    yield ev("production", "failed", prod.error);
    return;
  }
  const videoId = prod.data?.video_id as string | undefined;
  if (!videoId) {
    yield ev("production", "failed", "Production returned no video_id");
    return;
  }
  const quality = prod.data?.quality as { score?: number } | undefined;
  const reframed = prod.data?.reframed === true;
  const finalTopic = prod.data?.topic as string | undefined;
  const attempts = prod.data?.refine_attempts as number | undefined;
  const gateNote = quality?.score != null ? ` (gate ${quality.score}/100)` : "";
  const detail =
    reframed && finalTopic
      ? `Reframed after ${attempts ?? "?"} tries → "${finalTopic}"${gateNote}`
      : `Script ready${gateNote}`;
  yield ev("production", "done", detail, {
    video_id: videoId,
    topic: finalTopic,
    reframed,
    refine_attempts: attempts,
  });

  // ── 5. Render — non-fatal (QA reviews the script even if media isn't set up) ─
  yield ev("render", "running", "Voice + captions + thumbnail…");
  try {
    const r = await renderVideoRow(db, videoId, { includeShort: true });
    yield ev("render", "done", `Rendered ~${Math.round(r.longForm.durationSecs)}s${r.short ? " + short" : ""}`);
  } catch (e) {
    yield ev("render", "failed", `${e instanceof Error ? e.message : String(e)} — continuing; QA reviews the script.`);
  }

  // ── 6. QA Reviewer — gate to the Publisher ──────────────────────────────────
  yield ev("qa", "running", "Reviewing the finished package…");
  const qa = await safeRun(() => new QAReviewerAgent().run({ video_id: videoId }));
  if (!qa.success) {
    yield ev("qa", "failed", qa.error);
    return;
  }
  const verdict = qa.data?.qa as { decision?: string; score?: number } | undefined;
  if (verdict?.decision === "reject") {
    yield ev("qa", "failed", `QA rejected the package (score ${verdict.score ?? "?"})`);
    return;
  }
  yield ev("qa", "done", `QA ${verdict?.decision ?? "passed"} (score ${verdict?.score ?? "?"})`);

  // ── 7. Publisher — metadata + queues the publish approval ───────────────────
  yield ev("publisher", "running", "Optimising metadata & scheduling…");
  const pub = await safeRun(() => new PublisherAgent().run({ video_id: videoId }));
  if (!pub.success) {
    yield ev("publisher", "failed", pub.error);
    return;
  }
  yield ev("publisher", "awaiting_approval", "Queued for your approval — approve on the Approvals page to upload.", {
    approval_id: pub.data?.approval_id,
    video_id: videoId,
  });
}
