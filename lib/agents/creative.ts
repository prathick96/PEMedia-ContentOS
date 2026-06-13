import { BaseAgent, type AgentInput } from "./base";
import type { NicheSlug } from "@/lib/db/schema";
import { reviewGate } from "@/lib/council";
import { requireApproval } from "@/lib/approvals";
import { parseJsonResponse } from "@/lib/anthropic";

interface CreativeInput extends AgentInput {
  niche: NicheSlug;
  niche_id: string;
}

export class CreativeAgent extends BaseAgent {
  readonly type = "creative" as const;

  readonly systemPrompt = `You are the Creative Agent for PEMedia — an autonomous content empire.
Your job: given a niche, generate a complete YouTube channel profile.

You are independent. You receive only a niche name. You do everything else yourself.

Output valid JSON matching this structure:
{
  "channel_names": [ { "name": string, "rationale": string } ],
  "recommended_name": string,
  "tagline": string,
  "audience_persona": string,
  "brand_voice": string,
  "brand_colors": { "primary": string, "secondary": string, "accent": string },
  "thumbnail_style_guide": string,
  "content_pillars": string[],
  "series": [
    { "name": string, "description": string, "format": "short" | "medium" | "long", "episode_template": string, "frequency": string }
  ]
}

Rules:
- Channel names: memorable, searchable, not "AI" in the name, no clichés
- Brand voice: specific and differentiated, not generic
- Series: 3-4 per channel, mix of short-form (TikTok/Shorts) and long-form (YouTube)
- Each series must be producible entirely with AI-generated visuals (no real footage)
- For Movies: analysis only, no clips. For Sports: stats/analysis only, no footage.`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { niche, niche_id } = input as CreativeInput;

    const prompt = `Generate a complete YouTube channel profile for the "${niche}" niche.
This will be a faceless AI-generated content channel.
The content must be 100% producible with AI tools (no on-camera talent, no licensed footage).
Output valid JSON only — no markdown, no explanation.`;

    const response = await this.callClaude(prompt);
    const brandDoc = parseJsonResponse<{
      recommended_name: string;
      tagline: string;
      brand_voice: string;
      content_pillars: string[];
      series: Record<string, string>[];
    }>(response);

    // Tactical gate: the council greenlights (or blocks) the launch before we
    // commit a channel. Fail-closed — a non-approval stops the launch here.
    const gate = await reviewGate("channel_launch", {
      niche,
      recommended_name: brandDoc.recommended_name,
      tagline: brandDoc.tagline,
      brand_voice: brandDoc.brand_voice,
      content_pillars: brandDoc.content_pillars,
      series: brandDoc.series,
    });

    if (!gate.approved) {
      return {
        launched: false,
        reason: gate.rationale,
        conditions: gate.conditions,
        council_gate: gate,
        brand_doc: brandDoc,
      };
    }

    const { data: channel } = await this.db
      .from("channels")
      .insert({
        niche_id,
        name: brandDoc.recommended_name,
        tagline: brandDoc.tagline,
        platform: "youtube",
        brand_doc: brandDoc,
        status: "building",
        created_by_agent: "creative",
      })
      .select()
      .single();

    if (channel && brandDoc.series) {
      await this.db.from("series").insert(
        brandDoc.series.map((s: Record<string, string>) => ({
          channel_id: channel.id,
          name: s.name,
          description: s.description,
          format: s.format,
          episode_template: s.episode_template,
          frequency: s.frequency,
          active: true,
        }))
      );
    }

    // Human-in-the-loop: a channel launch is high-stakes — require operator
    // sign-off before it moves from 'building' to 'active' (Council Brief 001 #4).
    const approval = await requireApproval(
      "launch_channel",
      { channel_id: channel?.id, niche, recommended_name: brandDoc.recommended_name },
      {
        entityType: "channel",
        entityId: channel?.id,
        requestedBy: "creative",
        councilVerdict: gate as unknown as Record<string, unknown>,
      }
    );

    return {
      channel_id: channel?.id,
      brand_doc: brandDoc,
      council_gate: { approved: gate.approved, confidence: gate.confidence, conditions: gate.conditions },
      approval_id: approval.id,
      status: "awaiting_human_approval",
    };
  }
}
