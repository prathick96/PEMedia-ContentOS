/**
 * lib/queues/index.ts
 *
 * Job queue — QStash path (serverless-safe, Vercel-compatible).
 *
 * Architecture:
 *   enqueueAgent() publishes a signed HTTP message via QStash to /api/queue.
 *   QStash delivers it with retries + exponential backoff. /api/queue verifies
 *   the signature and dispatches to the matching agent class.
 *
 *   This replaces the Phase 0 BullMQ wiring, which passed `@upstash/redis` (REST
 *   client) as the BullMQ connection. BullMQ requires a raw TCP (ioredis) connection
 *   and cannot run on Vercel serverless. See workers/agent-worker.ts for the
 *   path-B long-running worker stub if a persistent host is added later.
 *
 * Required env vars:
 *   QSTASH_TOKEN          — upstash.com > QStash > API Keys
 *   NEXT_PUBLIC_APP_URL   — e.g. https://your-app.vercel.app (no trailing slash)
 */

import { Client } from "@upstash/qstash";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    if (!process.env.QSTASH_TOKEN) {
      throw new Error("QSTASH_TOKEN is not set. Add it to .env.local.");
    }
    _client = new Client({ token: process.env.QSTASH_TOKEN });
  }
  return _client;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export interface EnqueueResult {
  messageId: string;
}

/**
 * Enqueue an agent job via QStash.
 *
 * @param agentType  one of: ceo | scout | creative | production | publisher | analytics
 * @param input      the payload passed to agent.run()
 * @param opts.delay milliseconds before delivery (converted to seconds for QStash)
 *
 * Note: BullMQ priority is not supported in QStash (HTTP-based). Jobs are delivered
 * in order with retries. Prioritisation happens at the CEO task-queue level.
 */
export async function enqueueAgent(
  agentType: string,
  input: Record<string, unknown>,
  opts?: { delay?: number }
): Promise<EnqueueResult> {
  const client = getClient();

  const result = await client.publishJSON({
    url: `${APP_URL}/api/queue`,
    body: { agentType, input },
    retries: 3,
    ...(opts?.delay ? { delay: Math.ceil(opts.delay / 1000) } : {}),
  });

  return { messageId: result.messageId };
}
