import { BaseAgent, type AgentInput } from "./base";
import { parseJsonResponse } from "@/lib/anthropic";
import { fetchRawSignals } from "@/lib/trends/fetcher";
import type { NicheSlug } from "@/lib/db/schema";

interface ScoutInput extends AgentInput {
  niches?: NicheSlug[];
}

interface ScoredTopic {
  topic: string;
  score: number;
  search_velocity: number;
  competition_gap: number;
  cpm_potential: number;
  ai_producibility: number;
  rationale: string;
  suggested_title: string;
  suggested_series_type: "short" | "medium" | "long";
  /** Which raw signals (by title) informed this topic, if any. */
  grounded_in?: string[];
}

export class ScoutAgent extends BaseAgent {
  readonly type = "scout" as const;

  readonly systemPrompt = `You are the Scout Agent for PEMedia — an autonomous content intelligence system.
Your job: analyze trending topics for a given niche and score them for content production.

You will usually receive LIVE SIGNALS scraped today from Hacker News, Reddit, and YouTube.
Treat them as ground truth about what is trending RIGHT NOW. Derive video topics from them —
synthesize, combine, and find the original angle; do not just copy headlines.

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
    "suggested_series_type": "short" | "medium" | "long",
    "grounded_in": string[] (titles of the live signals this topic derives from; [] if none)
  }
]`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { niches = ["tech", "history"] } = input as ScoutInput;
    const results: Record<string, unknown[]> = {};
    const sourceHealth: Record<string, { ok: string[]; failed: string[] }> = {};

    for (const niche of niches) {
      const signals = await fetchRawSignals(niche);
      sourceHealth[niche] = { ok: signals.sourcesOk, failed: signals.sourcesFailed };

      const today = new Date().toISOString().split("T")[0];
      const hasLiveData = signals.items.length > 0;

      const prompt = hasLiveData
        ? `Generate the top 5 video topics for the "${niche}" niche on YouTube. Today: ${today}

LIVE SIGNALS (captured today — your ground truth):
${signals.items
  .map((s, i) => `${i + 1}. [${s.source}, ${s.metric} ${s.metricLabel}] ${s.title}`)
  .join("\n")}

Derive original, AI-producible video topics from these signals. Avoid pure rehashes.
Output valid JSON array only.`
        : `Generate the top 5 trending video topics for the "${niche}" niche on YouTube right now.
Today's date: ${today}
NOTE: live trend sources are unavailable — generate from your knowledge and set "grounded_in": [].
Focus on topics with high production feasibility using only AI-generated visuals.
Output valid JSON array only.`;

      const response = await this.callClaude(prompt);
      const topics = parseJsonResponse<ScoredTopic[]>(response);
      results[niche] = topics;

      const niche_record = await this.db
        .from("niches")
        .select("id")
        .eq("slug", niche)
        .single();

      if (niche_record.data) {
        await this.db.from("trend_signals").insert(
          topics.map((t) => {
            // Attribute the topic to the source of its strongest grounding signal.
            const grounding = (t.grounded_in ?? [])
              .map((title) => signals.items.find((s) => s.title === title))
              .filter(Boolean);
            const source = grounding[0]?.source ?? "claude_analysis";
            return {
              niche_id: niche_record.data.id,
              topic: t.topic,
              source,
              score: t.score,
              raw_data: { ...t, live_signals: grounding },
              captured_at: new Date().toISOString(),
            };
          })
        );
      }
    }

    return {
      briefing: results,
      source_health: sourceHealth,
      generated_at: new Date().toISOString(),
    };
  }
}
