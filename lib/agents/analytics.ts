import { BaseAgent, type AgentInput } from "./base";
import { parseJsonResponse } from "@/lib/anthropic";

export class AnalyticsAgent extends BaseAgent {
  readonly type = "analytics" as const;

  readonly systemPrompt = `You are the Analytics Agent for PEMedia.
You analyse performance data and surface strategic recommendations for the CEO Agent.

When given channel analytics data, identify:
1. Top performing videos (above 45% average view duration threshold)
2. Underperforming series (below 45% avg view duration)
3. Patterns in high-performing title formats
4. Revenue trends by stream
5. Growth velocity vs targets

Output valid JSON:
{
  "report_date": string,
  "channel_id": string,
  "summary": string,
  "top_videos": array,
  "underperforming_series": array,
  "patterns": string[],
  "revenue_breakdown": object,
  "recommendations": [
    { "priority": "high"|"medium"|"low", "action": string, "reason": string }
  ]
}`;

  protected async execute(input: AgentInput): Promise<Record<string, unknown>> {
    const channelId = input.channel_id as string | undefined;

    const query = this.db
      .from("analytics_snaps")
      .select("*")
      .order("date", { ascending: false })
      .limit(7);

    if (channelId) query.eq("channel_id", channelId);
    const { data: snapshots } = await query;

    const { data: revenue } = await this.db
      .from("revenue_entries")
      .select("*")
      .order("date", { ascending: false })
      .limit(30);

    const prompt = `Generate a weekly analytics report.
Analytics snapshots (last 7 days): ${JSON.stringify(snapshots ?? [])}
Revenue entries (last 30 days): ${JSON.stringify(revenue ?? [])}
Output valid JSON only.`;

    const response = await this.callClaude(prompt);
    return parseJsonResponse<Record<string, unknown>>(response);
  }
}
