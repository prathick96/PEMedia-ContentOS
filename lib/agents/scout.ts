import { BaseAgent, type AgentInput } from "./base";
import type { NicheSlug } from "@/lib/db/schema";

interface ScoutInput extends AgentInput {
  niches?: NicheSlug[];
}

export class ScoutAgent extends BaseAgent {
  readonly type = "scout" as const;

  readonly systemPrompt = `You are the Scout Agent for PEMedia — an autonomous content intelligence system.
Your job: analyze trending topics for a given niche and score them for content production.

Score each topic on:
- search_velocity (0-10): how fast is it growing in search?
- competition_gap (0-10): low upload count on this exact keyword on YouTube?
- cpm_potential (0-10): estimated ad revenue potential for this topic?
- ai_producibility (0-10): can this be produced with AI visuals only (no footage, no clips)?

Output valid JSON array:
[
  {
    "topic": string,
    "score": number (0-100, weighted),
    "search_velocity": number,
    "competition_gap": number,
    "cpm_potential": number,
    "ai_producibility": number,
    "rationale": string,
    "suggested_title": string,
    "suggested_series_type": "short" | "medium" | "long"
  }
]`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { niches = ["tech", "history"] } = input as ScoutInput;
    const results: Record<string, unknown[]> = {};

    for (const niche of niches) {
      const prompt = `Generate the top 5 trending video topics for the "${niche}" niche on YouTube right now.
Today's date: ${new Date().toISOString().split("T")[0]}
Focus on topics with high production feasibility using only AI-generated visuals.
Output valid JSON array only.`;

      const response = await this.callClaude(prompt);
      const topics = JSON.parse(response);
      results[niche] = topics;

      const niche_record = await this.db
        .from("niches")
        .select("id")
        .eq("slug", niche)
        .single();

      if (niche_record.data) {
        await this.db.from("trend_signals").insert(
          topics.map((t: Record<string, unknown>) => ({
            niche_id: niche_record.data.id,
            topic: t.topic,
            source: "claude_analysis",
            score: t.score,
            raw_data: t,
            captured_at: new Date().toISOString(),
          }))
        );
      }
    }

    return { briefing: results, generated_at: new Date().toISOString() };
  }
}
