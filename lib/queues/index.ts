import { Queue } from "bullmq";
import { Redis } from "@upstash/redis";

const connection = {
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
};

export const agentQueue = new Queue("agents", { connection });
export const productionQueue = new Queue("production", { connection });
export const publisherQueue = new Queue("publisher", { connection });

export async function enqueueAgent(
  agentType: string,
  input: Record<string, unknown>,
  opts?: { delay?: number; priority?: number }
) {
  return agentQueue.add(agentType, { agentType, input }, {
    delay: opts?.delay,
    priority: opts?.priority ?? 5,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
