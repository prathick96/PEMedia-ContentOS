import { describe, expect, it } from "vitest";
import { deriveFinalStatus, isStaleRun, isTerminal, STALE_RUN_MS } from "./runs";
import type { PipelineEvent } from "./stages";

const ev = (stage: PipelineEvent["stage"], status: PipelineEvent["status"]): PipelineEvent => ({
  stage,
  status,
  at: "2026-01-01T00:00:00.000Z",
});

describe("deriveFinalStatus", () => {
  it("maps a publisher hand-off (awaiting_approval) to awaiting_approval", () => {
    expect(deriveFinalStatus(ev("publisher", "awaiting_approval"))).toBe("awaiting_approval");
  });

  it("maps a terminal failure to failed", () => {
    expect(deriveFinalStatus(ev("production", "failed"))).toBe("failed");
  });

  it("maps a clean finish to completed", () => {
    expect(deriveFinalStatus(ev("publisher", "done"))).toBe("completed");
  });

  it("treats a missing last event as failed", () => {
    expect(deriveFinalStatus(undefined)).toBe("failed");
  });
});

describe("isTerminal", () => {
  it("is false only while running", () => {
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("awaiting_approval")).toBe(true);
  });
});

describe("isStaleRun", () => {
  const now = 1_000_000_000_000;

  it("flags a running row whose last update is older than the threshold", () => {
    const updated = new Date(now - STALE_RUN_MS - 1).toISOString();
    expect(isStaleRun({ status: "running", updated_at: updated }, now)).toBe(true);
  });

  it("does not flag a recently-updated running row", () => {
    const updated = new Date(now - 1000).toISOString();
    expect(isStaleRun({ status: "running", updated_at: updated }, now)).toBe(false);
  });

  it("never flags a terminal row, however old", () => {
    const updated = new Date(now - STALE_RUN_MS * 10).toISOString();
    expect(isStaleRun({ status: "completed", updated_at: updated }, now)).toBe(false);
  });
});
