import { BaseAgent, type AgentInput } from "./base";
import { convene } from "@/lib/council";

export class CeoAgent extends BaseAgent {
  readonly type = "ceo" as const;

  readonly systemPrompt = `You are the CEO Agent for PEMedia — an autonomous content empire.
You are the master orchestrator. You read data from all sources and issue a daily task queue.

Your decision framework:
1. Read last night's analytics snapshot
2. Read Scout Agent's trend briefing
3. Check the content pipeline for bottlenecks
4. Issue today's task queue as structured JSON

Output valid JSON:
{
  "date": string,
  "assessment": string,
  "tasks": [
    {
      "agent": "scout" | "creative" | "production" | "publisher" | "analytics",
      "action": string,
      "params": object,
      "priority": "high" | "medium" | "low",
      "reason": string
    }
  ],
  "flags": string[]
}`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const { data: channels } = await this.db.from("channels").select("*").eq("status", "active");
    const { data: readyVideos } = await this.db.from("videos").select("id, title").eq("status", "READY");
    const { data: recentTrends } = await this.db
      .from("trend_signals")
      .select("*")
      .is("used_in_video_id", null)
      .order("score", { ascending: false })
      .limit(10);

    // Strategic layer: convene the LLM council for top-level direction BEFORE
    // dispatching the daily queue (Council Brief 001, decision #5).
    const strategy = await this.strategicReview({
      activeChannels: channels?.length ?? 0,
      readyVideos: readyVideos?.length ?? 0,
      unusedTrends: recentTrends?.length ?? 0,
      input,
    });

    const prompt = `Daily CEO briefing for ${new Date().toISOString().split("T")[0]}

Active channels: ${channels?.length ?? 0}
Videos ready to publish: ${readyVideos?.length ?? 0}
Unused trend signals available: ${recentTrends?.length ?? 0}

Input context: ${JSON.stringify(input)}

COUNCIL DIRECTIVE (this is your strategic guidance — your task queue must serve it):
${strategy.decision}
Ranked strategic actions: ${JSON.stringify(strategy.rankedActions)}${
      strategy.dissents.length ? `\nNoted dissents to keep in mind: ${JSON.stringify(strategy.dissents)}` : ""
    }

Based on this data and the council directive, generate today's task queue for the content empire.
Prioritise originality and quality over volume (YouTube demonetises mass-produced content).
If no channels exist, prioritise launching the Tech channel FIRST (alone) via the Creative Agent.
Output valid JSON only.`;

    const response = await this.callClaude(prompt);
    const queue = JSON.parse(response);

    return {
      ...queue,
      council: {
        decision: strategy.decision,
        confidence: strategy.confidence,
        rankedActions: strategy.rankedActions,
        dissents: strategy.dissents,
      },
    };
  }

  /** Convene the council for the CEO's daily strategic direction. */
  private async strategicReview(context: Record<string, unknown>) {
    return convene(
      `Set today's top-level direction for the PEMedia CEO agent. Given the current state, what
should the CEO prioritise to advance toward $5,000 MRR while staying compliant with YouTube's
inauthentic-content policy? Concentrate effort on one excellent channel; favour quality over volume.`,
      context
    );
  }
}
