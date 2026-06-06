/**
 * app/api/queue/route.ts
 *
 * QStash receiver endpoint — the single entry point for all queued agent jobs.
 *
 * Flow:
 *   1. QStash POSTs here with a signed body: { agentType, input }
 *   2. We verify the HMAC signature (rejects anything not from QStash)
 *   3. We dispatch to the matching agent class and return the result
 *   4. On failure, we return 5xx so QStash retries (up to 3x with backoff)
 *
 * Direct agent calls (e.g. CEO → Scout within an orchestration run) still go
 * to /api/agents/* — those routes are not QStash-verified and are for
 * synchronous internal use only.
 */

import { NextResponse } from "next/server";
import { verifyQStashRequest } from "@/lib/queues/receiver";
import type { BaseAgent } from "@/lib/agents/base";
import { CeoAgent } from "@/lib/agents/ceo";
import { ScoutAgent } from "@/lib/agents/scout";
import { CreativeAgent } from "@/lib/agents/creative";
import { ProductionAgent } from "@/lib/agents/production";
import { PublisherAgent } from "@/lib/agents/publisher";
import { AnalyticsAgent } from "@/lib/agents/analytics";

const AGENTS: Record<string, new () => BaseAgent> = {
  ceo: CeoAgent,
  scout: ScoutAgent,
  creative: CreativeAgent,
  production: ProductionAgent,
  publisher: PublisherAgent,
  analytics: AnalyticsAgent,
};

const VALID_AGENTS = Object.keys(AGENTS).join(" | ");

export async function POST(req: Request) {
  let agentType: string | undefined;

  try {
    // Step 1: verify QStash signature — rejects anything not signed by QStash
    const rawBody = await verifyQStashRequest(req);

    // Step 2: parse payload
    const payload = JSON.parse(rawBody) as {
      agentType?: string;
      input?: Record<string, unknown>;
    };

    agentType = payload.agentType;
    const input = payload.input ?? {};

    if (!agentType) {
      return NextResponse.json(
        { success: false, error: "agentType is required in the QStash payload" },
        { status: 400 }
      );
    }

    // Step 3: dispatch
    const AgentClass = AGENTS[agentType];
    if (!AgentClass) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown agentType: "${agentType}". Valid: ${VALID_AGENTS}`,
        },
        { status: 400 }
      );
    }

    const agent = new AgentClass();
    const result = await agent.run(input);

    return NextResponse.json({ success: true, agentType, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Signature errors → 401 (QStash won't retry 4xx)
    const isAuthError =
      message.includes("signature") ||
      message.includes("QStash") ||
      message.includes("upstash-signature");

    if (isAuthError) {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }

    // All other errors → 500 so QStash retries
    console.error(`[/api/queue] Agent "${agentType}" failed:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
