/**
 * lib/scheduling/ceo-schedule.ts
 *
 * Daily CEO orchestration schedule (QStash cron).
 *
 * The CEO Agent is the master orchestrator — it must run once every morning to
 * convene the council, read overnight state, and dispatch the day's task queue.
 * This module manages a single QStash schedule that fires daily and POSTs to the
 * existing /api/queue receiver with { agentType: "ceo" }.
 *
 * Why reuse /api/queue: scheduled QStash invocations are signed with the same
 * signing keys as published messages, so /api/queue's signature check passes for
 * cron calls with zero extra wiring. One execution path for all agent runs.
 *
 * Idempotency: we pass a fixed scheduleId, so calling register() repeatedly
 * upserts the same schedule rather than creating duplicates.
 *
 * Required env vars:
 *   QSTASH_TOKEN         — to create/manage schedules
 *   NEXT_PUBLIC_APP_URL  — MUST be the deployed public URL (QStash cannot reach
 *                          localhost; schedules only fire against a reachable host)
 */

import { Client } from "@upstash/qstash";

/** Stable id → register() is idempotent (QStash upserts by scheduleId). */
export const CEO_SCHEDULE_ID = "ceo-daily-orchestration";

/** Daily at 08:00 UTC. Cron: minute hour day month weekday. */
export const CEO_CRON = "0 8 * * *";

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

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!url || url.includes("localhost")) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a public, deployed URL for QStash schedules to fire " +
        "(QStash cannot reach localhost). Current value: " + (url ?? "unset")
    );
  }
  return url;
}

export interface ScheduleInfo {
  scheduleId: string;
  cron: string;
  destination: string;
}

/**
 * Create or update the daily CEO schedule. Idempotent via fixed scheduleId.
 * Returns the schedule id QStash assigned (equals CEO_SCHEDULE_ID).
 */
export async function registerCeoSchedule(): Promise<ScheduleInfo> {
  const client = getClient();
  const destination = `${getAppUrl()}/api/queue`;

  const { scheduleId } = await client.schedules.create({
    scheduleId: CEO_SCHEDULE_ID,
    destination,
    cron: CEO_CRON,
    body: JSON.stringify({
      agentType: "ceo",
      triggeredBy: "cron",
      input: { reason: "daily 08:00 UTC orchestration", source: "qstash-schedule" },
    }),
    headers: { "Content-Type": "application/json" },
    retries: 3,
  });

  return { scheduleId, cron: CEO_CRON, destination };
}

/** Fetch the current CEO schedule, or null if it doesn't exist. */
export async function getCeoSchedule() {
  const client = getClient();
  try {
    return await client.schedules.get(CEO_SCHEDULE_ID);
  } catch {
    return null;
  }
}

/** Delete the CEO schedule. Safe to call even if it doesn't exist. */
export async function removeCeoSchedule(): Promise<void> {
  const client = getClient();
  try {
    await client.schedules.delete(CEO_SCHEDULE_ID);
  } catch {
    // already gone — no-op
  }
}
