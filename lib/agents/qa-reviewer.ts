import { BaseAgent, type AgentInput } from "./base";
import { reviewPackage } from "@/lib/qa-review";
import type { BrandVoice, VideoScript } from "@/lib/db/schema";

/**
 * QA Reviewer Agent — the gate between Production and Publisher.
 *
 * It reviews the FINISHED package (script + narration + visual plan + thumbnail
 * + metadata + vertical short) and decides: auto_publish | needs_human_review |
 * reject. On any non-reject it advances the video to READY (eligible for the
 * Publisher); on reject it leaves the video where it is for regeneration.
 *
 * Council Brief 003: QA never rewards hidden AI provenance — disclosure is
 * mandatory. The existing human publish-approval stays ON as the safety net
 * until QA has earned enough trust to let auto_publish skip it.
 */
export class QAReviewerAgent extends BaseAgent {
  readonly type = "qa" as const;

  readonly systemPrompt =
    "QA Reviewer — scores a finished video package and gates publication. " +
    "The scoring rubric lives in lib/qa-review/reviewer.ts; this agent orchestrates the gate.";

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { video_id } = input;
    if (!video_id) throw new Error("QA Reviewer requires a video_id");

    const { data: video } = await this.db
      .from("videos")
      .select("*, series(name, episode_template, channels(name, brand_doc, niches(slug)))")
      .eq("id", video_id)
      .single();

    if (!video) throw new Error(`Video ${video_id} not found`);
    if (!video.script) throw new Error(`Video ${video_id} has no script/package to review`);

    const series = video.series as Record<string, unknown> | null;
    const channel = series?.channels as Record<string, unknown> | null;
    const niche = (channel?.niches as Record<string, unknown> | null)?.slug as string ?? "tech";
    const brandDoc = channel?.brand_doc as Record<string, unknown> | null;

    const verdict = await reviewPackage({
      topic: video.topic as string,
      niche,
      series_format: (series?.episode_template as string) ?? "",
      brand_voice: stringifyBrandVoice(brandDoc?.brand_voice),
      script: video.script as VideoScript,
      // Publisher forces AI disclosure on every surface — disclosure is guaranteed.
      ai_disclosure_enforced: true,
      db: this.db,
      video_id: video.id as string,
      series_id: video.series_id as string,
    });

    // Advance to READY on any pass; leave it for regeneration on reject.
    let status = video.status as string;
    if (verdict.decision !== "reject") {
      await this.db.from("videos").update({ status: "READY" }).eq("id", video_id);
      status = "READY";
    }

    return {
      video_id,
      qa: verdict,
      status,
      next_step: verdict.decision === "reject" ? "regenerate" : "publisher",
    };
  }
}

/** Brand voice may be a plain string or the structured {dos,donts,example_sentence}. */
function stringifyBrandVoice(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const bv = v as Partial<BrandVoice>;
    const parts: string[] = [];
    if (bv.dos?.length) parts.push(`Do: ${bv.dos.join("; ")}`);
    if (bv.donts?.length) parts.push(`Don't: ${bv.donts.join("; ")}`);
    if (bv.example_sentence) parts.push(`Example: ${bv.example_sentence}`);
    return parts.join(" | ");
  }
  return "";
}
