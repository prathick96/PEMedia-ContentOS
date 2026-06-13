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
Your job: given a niche, generate a complete YouTube channel profile strong enough to compete in 2026,
where viewers actively punish generic "AI slop" channels and reward distinct, reliable formats.

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

NAMING — this outlives every other decision:
- 1–2 words, short enough to read at thumbnail size; easy to say aloud and spell after hearing it once
- Must work as the SAME @handle across YouTube, Instagram, TikTok, and Facebook — prefer
  distinctive coinages over common words (common words are always squatted on some platform)
- BANNED: "AI" anywhere in the name; exhausted patterns: Hub, Lab(s), Verse, Vault, Nexus, Pulse, Byte(s), Tech- prefixes, -ly suffixes
- The name should imply the channel's promise — what a viewer reliably gets every episode
- Generate 5 candidates with rationale, then recommend the one a stranger would still remember tomorrow

BRAND VOICE — make it forgeable by a script writer:
- Express as 3 specific DOs + 3 specific DON'Ts + one example sentence written in the voice
- A blind reader must be able to tell this channel's script from a generic channel's script

AUDIENCE PERSONA — one concrete person, not a demographic:
- Age, job, what they're trying to achieve, what makes them click at 11pm, what makes them unsubscribe

SERIES DESIGN (exactly 4):
- A series is a REPEATABLE FORMAT with the hook built into the format itself — not a topic bucket
- episode_template must be a beat sheet with rough timestamps: cold open (0–5s) → setup → escalation/payoff cadence → resolution → soft CTA
- Mix: 2 long (6–10 min), 1 medium (3–5 min), 1 short (<60s vertical)
- The short series is CROSS-PLATFORM VERTICAL by design: 9:16, hook in the first second,
  burned-in captions, self-contained payoff, platform-neutral CTA (never "subscribe below" —
  the same file posts to YouTube Shorts, Instagram Reels, TikTok, and Facebook Reels)
- Long-form episodes must be designed so a 30–45s vertical highlight can be cut from them
- Every series 100% producible faceless: AI visuals + screen recordings + stock b-roll; no on-camera talent, no licensed footage
- For Movies: analysis only, no clips. For Sports: stats/analysis only, no footage.

THUMBNAIL STYLE GUIDE:
- Concrete enough that two different designers produce visually consistent thumbnails
- Composition rule, palette usage from brand_colors, text ≤4 words, one recurring visual motif`;

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
