import { BaseAgent, type AgentInput } from "./base";
import { requireApproval } from "@/lib/approvals";
import { parseJsonResponse } from "@/lib/anthropic";

export class PublisherAgent extends BaseAgent {
  readonly type = "publisher" as const;

  readonly systemPrompt = `You are the Publisher Agent for PEMedia.
You handle final metadata optimisation before upload.

Given a video record, optimise:
1. Title: A/B test the best option from script title_options based on current CTR data
2. Description: Ensure affiliate links are replaced, timestamps are correct
3. Tags: Remove duplicates, ensure top 3 tags match title keywords
4. Thumbnail: Confirm thumbnail text matches chosen title

Output valid JSON:
{
  "final_title": string,
  "final_description": string,
  "final_tags": string[],
  "thumbnail_confirmed": boolean,
  "scheduled_at": string (ISO, randomised ±90min from optimal window),
  "platform_specific": {
    "youtube": { "category_id": string, "made_for_kids": false, "ai_disclosure": boolean },
    "tiktok": { "hashtags": string[], "ai_generated_label": boolean },
    "instagram": { "hashtags": string[], "ai_disclosure": boolean },
    "facebook": { "hashtags": string[], "ai_disclosure": boolean }
  }
}`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { video_id } = input;

    const { data: video } = await this.db
      .from("videos")
      .select("*, series(*, channels(*))")
      .eq("id", video_id)
      .single();

    if (!video) throw new Error(`Video ${video_id} not found`);
    if (video.status !== "READY") throw new Error(`Video ${video_id} is not READY (status: ${video.status})`);

    const targetHour = 9;
    const jitterMins = Math.floor(Math.random() * 180) - 90;
    const scheduledAt = new Date();
    scheduledAt.setHours(targetHour, jitterMins < 0 ? 60 + jitterMins : jitterMins, 0, 0);
    if (scheduledAt < new Date()) scheduledAt.setDate(scheduledAt.getDate() + 1);

    const prompt = `Optimise publishing metadata for this video:
Title options: ${JSON.stringify(video.script?.title_options)}
Tags: ${JSON.stringify(video.tags)}
Description: ${video.description}
Channel: ${JSON.stringify(video.series?.channels)}
Output valid JSON only.`;

    const optimised = parseJsonResponse<Record<string, unknown> & {
      platform_specific?: {
        youtube?: Record<string, unknown>;
        tiktok?: Record<string, unknown>;
        instagram?: Record<string, unknown>;
        facebook?: Record<string, unknown>;
      };
    }>(await this.callClaude(prompt));
    optimised.scheduled_at = scheduledAt.toISOString();

    // Compliance (Council Brief 001 §1.3): our videos use synthetic voice/visuals,
    // so the AI-disclosure / AI-label on EVERY surface we cross-post to is MANDATORY.
    // Force the flags ON regardless of model output — undisclosed synthetic media
    // risks YPP suspension and removal on Meta/TikTok.
    optimised.platform_specific = optimised.platform_specific ?? {};
    optimised.platform_specific.youtube = {
      ...(optimised.platform_specific.youtube ?? {}),
      ai_disclosure: true,
      made_for_kids: false,
    };
    optimised.platform_specific.tiktok = {
      ...(optimised.platform_specific.tiktok ?? {}),
      ai_generated_label: true,
    };
    optimised.platform_specific.instagram = {
      ...(optimised.platform_specific.instagram ?? {}),
      ai_disclosure: true,
    };
    optimised.platform_specific.facebook = {
      ...(optimised.platform_specific.facebook ?? {}),
      ai_disclosure: true,
    };

    await this.db
      .from("videos")
      .update({
        title: optimised.final_title,
        description: optimised.final_description,
        tags: optimised.final_tags,
        status: "SCHEDULED",
        scheduled_at: optimised.scheduled_at,
      })
      .eq("id", video_id);

    // Human-in-the-loop: publishing is high-stakes. Queue an approval the operator
    // must clear before the uploader pushes this live (Council Brief 001 #4).
    const approval = await requireApproval(
      "publish_video",
      {
        video_id,
        final_title: optimised.final_title,
        scheduled_at: optimised.scheduled_at,
        ai_disclosure: true,
      },
      { entityType: "video", entityId: video_id as string, requestedBy: "publisher" }
    );

    return {
      video_id,
      ...optimised,
      approval_id: approval.id,
      next_step: "await_human_approval_then_upload",
    };
  }
}
