/**
 * Agent worker — ARCHITECTURE NOTE (Council Brief 001 §2.5).
 *
 * Phase 0 wired BullMQ (lib/queues/index.ts) to `@upstash/redis`, which is a REST
 * client. BullMQ requires a raw TCP (ioredis) connection and CANNOT run on the
 * Upstash REST SDK. Two supported paths:
 *
 *   A) RECOMMENDED for solo serverless (Vercel): drop the long-lived BullMQ worker
 *      and use `@upstash/qstash` (already a dependency) to schedule the daily CEO
 *      cron and fan out HTTP calls to the /api/agents/* routes. No always-on worker
 *      host required — fits Vercel's execution model.
 *
 *   B) If a persistent worker host is added later: keep BullMQ, but connect via
 *      ioredis to Upstash's TCP endpoint (rediss://...), NOT the REST URL. Only then
 *      does the worker below run.
 *
 * The skeleton below is path (B). It is intentionally NOT started anywhere yet —
 * it documents the contract a worker host would fulfil.
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
