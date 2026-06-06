/**
 * Agent worker — ARCHITECTURE NOTE (Council Brief 001 §2.5).
 *
 * STATUS: Path A (QStash) is now live and is the active queue layer.
 *
 * ── PATH A — ACTIVE (Vercel serverless) ─────────────────────────────────────
 *   lib/queues/index.ts     → enqueueAgent() publishes via QStash Client
 *   lib/queues/receiver.ts  → HMAC signature verification helper
 *   app/api/queue/route.ts  → QStash receiver endpoint, dispatches to agents
 *
 *   No always-on worker process required. QStash delivers HTTP messages to
 *   /api/queue with retries + exponential backoff. Fits Vercel's execution model.
 *
 * ── PATH B — DOCUMENTED ONLY (future persistent worker host) ────────────────
 *   If a persistent worker host (e.g. Railway, Fly.io) is added later, swap back
 *   to BullMQ but connect via ioredis to Upstash's TCP endpoint (rediss://...),
 *   NOT the REST URL that Phase 0 incorrectly used. The skeleton below is path B —
 *   it is intentionally NOT started anywhere and exists only to document the contract.
 */
import { Worker, type ConnectionOptions } from "bullmq";
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

/**
 * Start a BullMQ worker that dispatches queued jobs to the matching agent.
 * Requires an ioredis TCP `connection` (path B above) — do not pass the REST client.
 */
export function startAgentWorker(connection: ConnectionOptions): Worker {
  return new Worker(
    "agents",
    async (job) => {
      const { agentType, input } = job.data as {
        agentType: string;
        input: Record<string, unknown>;
      };
      const Agent = AGENTS[agentType];
      if (!Agent) throw new Error(`Unknown agent type: ${agentType}`);
      return new Agent().run(input);
    },
    { connection }
  );
}
